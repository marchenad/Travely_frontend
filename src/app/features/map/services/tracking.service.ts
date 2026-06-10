import { Injectable, inject, signal } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { forkJoin, interval, Observable, of, Subscription, EMPTY } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';
import { VehicleLocationService } from '../../../core/services/vehicle-location.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { Vehicle } from '../../../shared/models/vehicle.model';
import { VehicleLocation } from '../../../shared/models/vehicle-location.model';

const VEHICLE_REFRESH_MS = 8000;
const ETA_REFRESH_MS     = 30000;

@Injectable()
export class TrackingService {
  private readonly locationService = inject(VehicleLocationService);
  private readonly vehicleService  = inject(VehicleService);
  private readonly http            = inject(HttpClient);

  readonly tracking        = signal(false);
  readonly liveLocations   = signal<VehicleLocation[]>([]);
  readonly vehicles        = signal<Vehicle[]>([]);
  readonly wsConnected     = signal(false);
  readonly participantEtas = signal<Map<number, string>>(new Map());

  stompClient?: Client; // package-accessible for ChatService
  private vehicleRefreshSub?: Subscription;
  private etaSub?: Subscription;
  private pollingFallbackActive = false;

  private destLat = 0;
  private destLng = 0;

  start(tripId: number, destLat = 0, destLng = 0): void {
    this.stop();
    this.destLat = destLat;
    this.destLng = destLng;
    this.tracking.set(true);
    this.connectStomp(tripId);
    this.startVehicleRefresh(tripId);
    if (destLat !== 0 || destLng !== 0) {
      this.startEtaRefresh();
    }
  }

  stop(): void {
    this.stompClient?.deactivate();
    this.stompClient = undefined;
    this.vehicleRefreshSub?.unsubscribe();
    this.vehicleRefreshSub = undefined;
    this.etaSub?.unsubscribe();
    this.etaSub = undefined;
    this.pollingFallbackActive = false;
    this.tracking.set(false);
    this.wsConnected.set(false);
    this.liveLocations.set([]);
    this.participantEtas.set(new Map());
  }

  // ── WebSocket ──────────────────────────────────────────────────
  private connectStomp(tripId: number): void {
    const client = new Client({
      brokerURL: environment.wsUrl,
      reconnectDelay: 5000,
      onConnect: () => {
        this.wsConnected.set(true);
        client.subscribe(`/topic/trips/${tripId}/locations`, (msg: IMessage) => {
          const loc: VehicleLocation = JSON.parse(msg.body);
          this.liveLocations.update((prev) => {
            const idx = prev.findIndex((l) => l.vehicleId === loc.vehicleId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = loc;
              return next;
            }
            return [...prev, loc];
          });
        });
      },
      onDisconnect:    () => this.wsConnected.set(false),
      onStompError:    () => { this.wsConnected.set(false); this.fallbackToPolling(tripId); },
      onWebSocketError:() => { this.wsConnected.set(false); this.fallbackToPolling(tripId); },
    });

    this.stompClient = client;
    client.activate();
  }

  private fallbackToPolling(tripId: number): void {
    if (this.pollingFallbackActive) return;
    this.pollingFallbackActive = true;
    this.stompClient?.deactivate();
    this.stompClient = undefined;

    const pollSub = interval(5000).pipe(
      startWith(0),
      switchMap(() => this.locationService.getLatestByTrip(tripId).pipe(catchError(() => EMPTY))),
    ).subscribe((locs) => this.liveLocations.set(locs));

    const prev = this.vehicleRefreshSub;
    this.vehicleRefreshSub = {
      unsubscribe: () => { prev?.unsubscribe(); pollSub.unsubscribe(); },
      closed: false,
    } as Subscription;
  }

  // ── Vehículos ─────────────────────────────────────────────────
  private startVehicleRefresh(tripId: number): void {
    this.vehicleRefreshSub = interval(VEHICLE_REFRESH_MS).pipe(
      startWith(0),
      switchMap(() => this.vehicleService.getAll(tripId).pipe(catchError(() => EMPTY))),
    ).subscribe((vs) => this.vehicles.set(vs));
  }

  // ── ETAs ──────────────────────────────────────────────────────
  private startEtaRefresh(): void {
    this.etaSub = interval(ETA_REFRESH_MS).pipe(
      startWith(0),
      switchMap(() => this.computeAllEtas()),
    ).subscribe((etas) => this.participantEtas.set(etas));
  }

  private computeAllEtas(): Observable<Map<number, string>> {
    const locs = this.liveLocations();
    if (!locs.length || (this.destLat === 0 && this.destLng === 0)) {
      return of(new Map<number, string>());
    }

    type EtaResult = { vehicleId: number; seconds: number };

    const calls: Observable<EtaResult>[] = locs.map((loc) =>
      this.http.get<any>(
        `https://router.project-osrm.org/route/v1/driving/` +
        `${loc.longitude},${loc.latitude};${this.destLng},${this.destLat}?overview=false`,
      ).pipe(
        map((res): EtaResult => ({ vehicleId: loc.vehicleId, seconds: res?.routes?.[0]?.duration ?? 0 })),
        catchError((): Observable<EtaResult> => of({ vehicleId: loc.vehicleId, seconds: 0 })),
      ),
    );

    return forkJoin(calls).pipe(
      map((results) => {
        const etas = new Map<number, string>();
        results.forEach(({ vehicleId, seconds }) => {
          if (seconds > 0) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            etas.set(vehicleId, h > 0 ? `${h}h ${m}m` : `${m} min`);
          }
        });
        return etas;
      }),
    );
  }
}
