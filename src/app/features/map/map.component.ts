import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import * as L from 'leaflet';
import { Subject, of, EMPTY } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, timeout } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

import { TripService } from '../../core/services/trip.service';
import { WaypointService } from '../../core/services/waypoint.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { VehicleLocationService } from '../../core/services/vehicle-location.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { Trip, TripStatus } from '../../shared/models/trip.model';
import { Waypoint } from '../../shared/models/waypoint.model';
import { Vehicle } from '../../shared/models/vehicle.model';
import { VehicleLocation } from '../../shared/models/vehicle-location.model';

import { TrackingService }     from './services/tracking.service';
import { NavInviteService }    from './services/nav-invite.service';
import { ParticipantService }  from './services/participant.service';
import { ChatService }         from './services/chat.service';

// ── Tipos ────────────────────────────────────────────────────
interface CopilotLocation { nombre: string; lat: number; lng: number; }
interface CopilotMsg { role: 'user' | 'ai'; text: string; lugares?: CopilotLocation[]; }
interface CopilotResponse {
  tipo: 'INFO' | 'SET_ROUTE';
  mensaje: string;
  accion: string;
  lugares?: CopilotLocation[];
  destino?: { lat: number; lng: number };
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export type MapMode = 'default' | 'search' | 'trips' | 'navigation' | 'create-trip';

// ── Constantes ───────────────────────────────────────────────
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41],
  popupAnchor: [1, -34], shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
  providers: [TrackingService, NavInviteService, ParticipantService, ChatService],
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  // ── Servicios ────────────────────────────────────────────────
  private readonly tripService         = inject(TripService);
  private readonly waypointService     = inject(WaypointService);
  private readonly vehicleService      = inject(VehicleService);
  private readonly locationService     = inject(VehicleLocationService);
  readonly authService                 = inject(AuthService);
  private readonly toast               = inject(ToastService);
  private readonly http            = inject(HttpClient);
  private readonly fb              = inject(FormBuilder);
  private readonly destroyRef      = inject(DestroyRef);

  private readonly trackingSvc = inject(TrackingService);
  readonly invite      = inject(NavInviteService);
  readonly participant = inject(ParticipantService);
  readonly chat        = inject(ChatService);

  // ── Estado Leaflet (privado) ─────────────────────────────────
  private map!: L.Map;
  private markersLayer   = L.layerGroup();
  private routeLayer     = L.layerGroup();
  private vehicleLayer   = L.layerGroup();
  private copilotLayer   = L.layerGroup();
  private vehicleMarkers = new Map<number, L.CircleMarker>();
  private tempMarker?: L.Marker;
  private userMarker?: L.Marker;
  private watchId?: number;
  private participantVehicleId: number | null = null;
  private myVehicleId: number | null = null;
  private userLat = 0;
  private userLng = 0;

  // ── Estado de UI ─────────────────────────────────────────────
  readonly mode           = signal<MapMode>('default');
  readonly trips          = signal<Trip[]>([]);
  readonly tripsHasMore   = signal(false);
  readonly tripsLoading   = signal(false);
  private tripsPage       = 0;
  readonly activeTrip     = signal<Trip | null>(null);
  readonly navWaypoints   = signal<Waypoint[]>([]);
  readonly searchQuery    = signal('');
  readonly navEta         = signal('--');
  readonly locationStatus = signal<'pending' | 'granted' | 'denied' | 'unsupported'>('pending');
  readonly creating       = signal(false);
  readonly searchResults  = signal<NominatimResult[]>([]);
  readonly searchLoading  = signal(false);
  readonly showAddVehicle    = signal(false);
  readonly showVehiclesPanel = signal(false);
  readonly showRadioPanel    = signal(false);
  readonly showChatPanel     = signal(false);
  chatInput = '';
  readonly showCopilotPanel  = signal(false);
  readonly copilotMessages   = signal<CopilotMsg[]>([]);
  readonly copilotLoading    = signal(false);
  copilotInput = '';
  readonly audioEnabled      = signal(false);
  readonly navHeading        = signal(0);
  readonly following         = signal(true);

  // Signal aliases so templates can call tracking(), vehicles(), etc.
  get pendingNavInvite() { return this.invite.pending; }
  get tracking()         { return this.trackingSvc.tracking; }
  get vehicles()         { return this.trackingSvc.vehicles; }
  get liveLocations()    { return this.trackingSvc.liveLocations; }
  get foundUser()        { return this.participant.foundUser; }
  get inviteLoading()    { return this.participant.inviteLoading; }
  get inviteError()      { return this.participant.inviteError; }
  get inviting()         { return this.participant.inviting; }

  // ── Computados ───────────────────────────────────────────────
  readonly otherVehicles = computed(() => {
    const myId = this.authService.currentUser()?.userId;
    return this.trackingSvc.vehicles().filter((v) => v.driverId !== myId);
  });

  readonly currentWaypointIdx = signal(0);
  readonly currentInstruction = computed(() => {
    const wps = this.navWaypoints();
    const idx = this.currentWaypointIdx();
    if (!wps.length || idx >= wps.length) return '';
    return `Dirígete a ${wps[idx].name}`;
  });

  readonly maxSpeed = computed(() => {
    const locs = this.trackingSvc.liveLocations();
    return locs.length ? Math.max(...locs.map((l) => l.speed ?? 0)) : 0;
  });

  readonly mapTransform = computed(() => {
    if (this.mode() !== 'navigation') return 'none';
    const h = this.navHeading();
    return `perspective(700px) rotateX(22deg) rotate(${-h}deg) scale(1.55)`;
  });

  // ── Effects ──────────────────────────────────────────────────
  private readonly voiceEffect = effect(() => {
    const instruction = this.currentInstruction();
    if (!this.audioEnabled() || !instruction) return;
    this.speak(instruction);
  });

  // Actualiza marcadores Leaflet cuando cambian las ubicaciones
  private readonly markersEffect = effect(() => {
    this.updateVehicleMarkers(this.trackingSvc.liveLocations());
  });

  // ── Invitar usuario ──────────────────────────────────────────
  inviteEmailValue = '';

  private readonly searchSubject = new Subject<string>();
  private clickedLat = 0;
  private clickedLng = 0;

  readonly createForm = this.fb.group({
    title:       ['', [Validators.required, Validators.minLength(3)]],
    destination: ['', Validators.required],
  });

  // ── Ciclo de vida ─────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.initMap();
    this.loadTrips();
    this.initSearch();
    this.invite.startPolling(
      this.destroyRef,
      computed(() => this.mode() === 'navigation'),
    );
  }

  ngOnDestroy(): void {
    this.trackingSvc.stop();
    this.chat.stop();
    this.stopWatchingPosition();
    this.map?.remove();
  }

  // ── Mapa Leaflet ─────────────────────────────────────────────
  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [40.4168, -3.7038],
      zoom: 6,
      zoomControl: false,
      renderer: L.svg({ padding: 1 }),
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 20 },
    ).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.markersLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);
    this.vehicleLayer.addTo(this.map);
    this.copilotLayer.addTo(this.map);

    this.map.on('dragstart', () => this.following.set(false));
    this.requestLocation();
  }

  private requestLocation(): void {
    if (!navigator.geolocation) { this.locationStatus.set('unsupported'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locationStatus.set('granted');
        const { latitude: lat, longitude: lng } = pos.coords;
        this.updateUserPosition(lat, lng);
        this.map.flyTo([lat, lng], 17, { duration: 1.5 });
      },
      () => this.locationStatus.set('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  private updateUserPosition(lat: number, lng: number): void {
    this.userLat = lat;
    this.userLng = lng;
    const latlng: L.LatLngExpression = [lat, lng];
    if (this.userMarker) {
      this.userMarker.setLatLng(latlng);
    } else {
      const icon = L.divIcon({
        className: '',
        html: `<div class="user-location-marker">
                 <div class="user-location-marker__pulse"></div>
                 <div class="user-location-marker__dot"></div>
               </div>`,
        iconSize: [48, 48], iconAnchor: [24, 24],
      });
      this.userMarker = L.marker(latlng, { icon, zIndexOffset: 1000 })
        .bindPopup('Tu ubicación')
        .addTo(this.map);
    }
  }

  private startWatchingPosition(follow: boolean): void {
    if (!navigator.geolocation || this.watchId !== undefined) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading, speed } = pos.coords;
        this.updateUserPosition(lat, lng);
        if (follow && this.following()) {
          this.map.setView([lat, lng], this.map.getZoom(), { animate: true, duration: 0.4 });
          if (heading !== null && !isNaN(heading)) this.navHeading.set(heading);
        }
        if (this.myVehicleId !== null) {
          this.locationService.updateLocation(this.myVehicleId, {
            latitude: lat,
            longitude: lng,
            speed:   speed   !== null ? Math.round(speed * 3.6) : 0,
            heading: heading !== null && !isNaN(heading) ? heading : undefined,
          }).subscribe({ error: () => {} });
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000 },
    );
  }

  private stopWatchingPosition(): void {
    if (this.watchId !== undefined) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = undefined;
    }
  }

  centerOnUser(): void {
    this.following.set(true);
    if (this.userLat !== 0 || this.userLng !== 0) {
      this.map.flyTo([this.userLat, this.userLng], 17, { duration: 0.6 });
    }
  }

  // ── Marcadores de vehículos ──────────────────────────────────
  private updateVehicleMarkers(locations: VehicleLocation[]): void {
    const seen = new Set<number>();
    locations.forEach((loc) => {
      seen.add(loc.vehicleId);
      const latlng: L.LatLngExpression = [loc.latitude, loc.longitude];
      const vehicle = this.trackingSvc.vehicles().find((v) => v.id === loc.vehicleId);
      const label   = vehicle?.name ?? `Vehículo ${loc.vehicleId}`;
      const speed   = loc.speed ?? 0;
      const color   = speed > 0 ? '#f59e0b' : '#16a34a';
      const popup   = `<strong>${label}</strong><br>Velocidad: ${speed} km/h<br>
                       <small>${new Date(loc.timestamp).toLocaleTimeString()}</small>`;

      if (this.vehicleMarkers.has(loc.vehicleId)) {
        const m = this.vehicleMarkers.get(loc.vehicleId)!;
        m.setLatLng(latlng); m.setStyle({ fillColor: color }); m.setPopupContent(popup);
      } else {
        const m = L.circleMarker(latlng, {
          radius: 12, fillColor: color, color: '#fff', weight: 3, fillOpacity: 1,
        }).bindPopup(popup).addTo(this.vehicleLayer);
        this.vehicleMarkers.set(loc.vehicleId, m);
      }
    });
    this.vehicleMarkers.forEach((marker, vehicleId) => {
      if (!seen.has(vehicleId)) {
        this.vehicleLayer.removeLayer(marker);
        this.vehicleMarkers.delete(vehicleId);
      }
    });
  }

  private clearVehicleMarkers(): void {
    this.vehicleLayer.clearLayers();
    this.vehicleMarkers.clear();
  }

  // ── Rutas y waypoints ────────────────────────────────────────
  private drawOsrmRoute(destLat: number, destLng: number, fitMap = true): void {
    const hasOrigin = this.userLat !== 0 || this.userLng !== 0;
    if (!hasOrigin) {
      if (fitMap) this.map.flyTo([destLat, destLng], 10, { duration: 1 });
      return;
    }

    const url = `https://router.project-osrm.org/route/v1/driving/` +
      `${this.userLng},${this.userLat};${destLng},${destLat}?overview=full&geometries=geojson`;

    this.http.get<any>(url).pipe(catchError(() => of(null))).subscribe((res) => {
      this.routeLayer.clearLayers();
      if (res?.routes?.[0]?.geometry?.coordinates) {
        const coords: L.LatLngExpression[] = res.routes[0].geometry.coordinates
          .map(([lon, lat]: [number, number]) => [lat, lon] as L.LatLngExpression);
        L.polyline(coords, { color: '#fff',    weight: 10, opacity: 0.9 }).addTo(this.routeLayer);
        L.polyline(coords, { color: '#4f46e5', weight:  6, opacity: 1   }).addTo(this.routeLayer);
        if (fitMap) {
          this.map.fitBounds(L.latLngBounds(coords), { padding: [60, 60], duration: 1.2 } as any);
        }
      } else {
        const straight: L.LatLngExpression[] = [[this.userLat, this.userLng], [destLat, destLng]];
        L.polyline(straight, { color: '#4f46e5', weight: 5, opacity: 0.85, dashArray: '10 8' }).addTo(this.routeLayer);
        if (fitMap) this.map.fitBounds(L.latLngBounds(straight), { padding: [60, 60] });
      }
      L.circleMarker([destLat, destLng], {
        radius: 10, fillColor: '#dc2626', color: '#fff', weight: 3, fillOpacity: 1,
      }).addTo(this.routeLayer);
    });
  }

  private drawWaypoints(waypoints: Waypoint[]): void {
    if (!waypoints.length) return;
    [...waypoints].sort((a, b) => a.order - b.order).forEach((w) => {
      L.circleMarker([w.latitude, w.longitude], {
        radius: 8, fillColor: this.wpColor(w.type), color: '#fff', weight: 2, fillOpacity: 1,
      }).bindPopup(w.name).addTo(this.routeLayer);
    });
  }

  // ── Trips ────────────────────────────────────────────────────
  private loadTrips(): void {
    const userId = this.authService.currentUser()?.userId;
    if (!userId) return;
    this.tripsPage = 0;
    this.tripsLoading.set(true);
    this.tripService.getAllPaged(userId, 0).subscribe({
      next: (page) => {
        this.trips.set(page.content);
        this.tripsHasMore.set(!page.last);
        this.tripsLoading.set(false);
      },
      error: () => this.tripsLoading.set(false),
    });
  }

  loadMoreTrips(): void {
    const userId = this.authService.currentUser()?.userId;
    if (!userId || !this.tripsHasMore() || this.tripsLoading()) return;
    this.tripsPage++;
    this.tripsLoading.set(true);
    this.tripService.getAllPaged(userId, this.tripsPage).subscribe({
      next: (page) => {
        this.trips.update((ts) => [...ts, ...page.content]);
        this.tripsHasMore.set(!page.last);
        this.tripsLoading.set(false);
      },
      error: () => {
        this.tripsPage--;
        this.tripsLoading.set(false);
        this.toast.error('No se pudieron cargar más viajes.');
      },
    });
  }

  // ── Búsqueda Nominatim ───────────────────────────────────────
  private initSearch(): void {
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap((q) => {
        if (q.trim().length < 2) { this.searchResults.set([]); return of([]); }
        this.searchLoading.set(true);
        return this.http.get<NominatimResult[]>(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'Accept-Language': 'es' } },
        ).pipe(catchError(() => of([])));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((results) => {
      this.searchLoading.set(false);
      this.searchResults.set(results as NominatimResult[]);
    });
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchSubject.next(value);
    if (value.trim()) this.mode.set('search');
    else { this.searchResults.set([]); this.mode.set('default'); }
  }

  selectPlace(place: NominatimResult): void {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    this.searchQuery.set(place.display_name.split(',').slice(0, 2).join(',').trim());
    this.searchResults.set([]);
    this.mode.set('create-trip');
    this.map.flyTo([lat, lng], 13, { duration: 1.2 });
    this.clickedLat = lat;
    this.clickedLng = lng;
    this.removeTempMarker();
    this.tempMarker = L.marker([lat, lng])
      .bindPopup(`<strong>${this.searchQuery()}</strong>`)
      .addTo(this.map)
      .openPopup();
    this.createForm.reset();
    this.createForm.patchValue({
      destination: place.display_name.split(',').slice(0, 3).join(',').trim(),
    });
  }

  private removeTempMarker(): void {
    if (this.tempMarker) { this.map.removeLayer(this.tempMarker); this.tempMarker = undefined; }
  }

  cancelCreate(): void {
    this.removeTempMarker();
    this.mode.set('default');
  }

  submitCreateTrip(): void {
    if (this.createForm.invalid) return;
    this.creating.set(true);
    const userId = this.authService.currentUser()?.userId ?? 1;
    const v = this.createForm.getRawValue();
    this.tripService.create({
      title: v.title!, destinationName: v.destination!,
      destinationLatitude: this.clickedLat, destinationLongitude: this.clickedLng,
      creatorId: userId,
    }).subscribe({
      next: (trip) => {
        this.creating.set(false);
        this.removeTempMarker();
        this.mode.set('default');
        this.trips.update((ts) => [...ts, trip]);
        this.setActiveTrip(trip);
      },
      error: () => {
        this.creating.set(false);
        this.toast.error('No se pudo crear el viaje. Inténtalo de nuevo.');
      },
    });
  }

  // ── Selección de viaje ───────────────────────────────────────
  setActiveTrip(trip: Trip): void {
    this.activeTrip.set(trip);
    this.routeLayer.clearLayers();
    this.trackingSvc.stop();
    this.clearVehicleMarkers();
    this.showAddVehicle.set(false);
    this.waypointService.getByTrip(trip.id).subscribe((wps) => {
      this.navWaypoints.set(wps);
      this.drawWaypoints(wps);
    });
    this.vehicleService.getAll(trip.id).subscribe((vs) => {
      this.trackingSvc.vehicles.set(vs);
      this.trackingSvc.start(trip.id, trip.destinationLatitude, trip.destinationLongitude);
    });
  }

  deselectTrip(): void {
    this.activeTrip.set(null);
    this.routeLayer.clearLayers();
    this.trackingSvc.stop();
    this.clearVehicleMarkers();
    this.showAddVehicle.set(false);
  }

  // ── Participantes ────────────────────────────────────────────
  openAddVehicle(): void {
    this.inviteEmailValue = '';
    this.participant.reset();
    this.showAddVehicle.set(true);
  }

  closeAddVehicle(): void { this.showAddVehicle.set(false); }

  resetInviteSearch(): void { this.participant.reset(); }

  searchUserToInvite(): void {
    this.participant.searchUser(this.inviteEmailValue);
  }

  isAlreadyInTrip(userId: number): boolean {
    return this.participant.isAlreadyInTrip(userId, this.trackingSvc.vehicles());
  }

  confirmInviteUser(): void {
    const trip = this.activeTrip();
    const user = this.participant.foundUser();
    if (!trip || !user || this.participant.inviting()) return;
    this.participant.invite(trip, user, this.trackingSvc.vehicles()).then((vehicle) => {
      this.trackingSvc.vehicles.update((vs) => [...vs, vehicle]);
      this.showAddVehicle.set(false);
      this.inviteEmailValue = '';
    });
  }

  removeParticipant(vehicleId: number): void {
    this.participant.remove(vehicleId, () =>
      this.trackingSvc.vehicles.update((vs) => vs.filter((v) => v.id !== vehicleId)),
    );
  }

  // ── Navegación ───────────────────────────────────────────────
  startNavigation(): void {
    if (!this.activeTrip()) return;
    const trip = this.activeTrip()!;
    const me = this.authService.currentUser();

    const existing = this.trackingSvc.vehicles().find((v) => v.driverId === me?.userId);
    if (existing) {
      this.myVehicleId = existing.id;
    } else if (me) {
      this.vehicleService.create({
        name: me.name, licensePlate: '--------', color: '#6366f1',
        driverId: me.userId, tripId: trip.id,
      }).subscribe({
        next: (v) => {
          this.myVehicleId = v.id;
          this.trackingSvc.vehicles.update((vs) => [...vs, v]);
        },
        error: () => {},
      });
    }

    this.currentWaypointIdx.set(0);
    this.navEta.set('--');
    this.following.set(true);
    this.mode.set('navigation');
    this.chat.start(trip.id);

    this.tripService.updateStatus(trip.id, 'NAVIGATING' as TripStatus).subscribe({
      error: () => this.toast.warning('No se pudo notificar a los participantes. Comprueba la conexión.'),
    });

    this.drawOsrmRoute(trip.destinationLatitude, trip.destinationLongitude, false);

    if (this.userLat !== 0 || this.userLng !== 0) {
      this.map.setView([this.userLat, this.userLng], 17, { animate: true, duration: 1 });
    }

    this.startWatchingPosition(true);
    this.calculateEta(trip.destinationLatitude, trip.destinationLongitude);
  }

  private calculateEta(destLat: number, destLng: number): void {
    if (this.userLat === 0) return;
    const url = `https://router.project-osrm.org/route/v1/driving/` +
      `${this.userLng},${this.userLat};${destLng},${destLat}?overview=false`;
    this.http.get<any>(url).pipe(catchError(() => of(null))).subscribe((res) => {
      const seconds: number = res?.routes?.[0]?.duration ?? 0;
      if (seconds > 0) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        this.navEta.set(h > 0 ? `${h}h ${m}m` : `${m} min`);
      }
    });
  }

  cancelNavigation(): void {
    this.stopWatchingPosition();
    this.myVehicleId = null;
    this.following.set(true);
    this.showVehiclesPanel.set(false);
    this.showRadioPanel.set(false);
    this.showChatPanel.set(false);
    this.audioEnabled.set(false);
    this.chat.stop();
    window.speechSynthesis?.cancel();

    const trip   = this.activeTrip();
    const userId = this.authService.currentUser()?.userId;

    if (trip && trip.creatorId === userId) {
      this.tripService.updateStatus(trip.id, 'ACTIVE' as TripStatus).subscribe({
        error: () => this.toast.warning('No se pudo actualizar el estado del viaje.'),
      });
    } else if (trip) {
      this.participantVehicleId = null;
      this.trackingSvc.stop();
      this.clearVehicleMarkers();
      this.routeLayer.clearLayers();
      this.activeTrip.set(null);
      this.trackingSvc.vehicles.set([]);
      this.navWaypoints.set([]);
    }

    this.mode.set('default');
  }

  acceptNavInvite(): void {
    const vehicle = this.invite.accept();
    if (vehicle) this.enterParticipantNavigation(vehicle);
  }

  rejectNavInvite(): void { this.invite.reject(); }

  private enterParticipantNavigation(vehicle: Vehicle): void {
    const destLat = vehicle.tripDestinationLatitude ?? 0;
    const destLng = vehicle.tripDestinationLongitude ?? 0;

    const participantTrip: Trip = {
      id: vehicle.tripId,
      title: vehicle.tripTitle ?? 'Viaje en curso',
      destinationName: vehicle.tripDestinationName ?? '',
      destinationLatitude: destLat,
      destinationLongitude: destLng,
      status: 'NAVIGATING',
      creatorId: vehicle.tripCreatorId ?? 0,
      createdAt: '',
      updatedAt: vehicle.tripUpdatedAt ?? '',
    };

    this.participantVehicleId = vehicle.id;
    this.myVehicleId = vehicle.id;
    this.activeTrip.set(participantTrip);
    this.currentWaypointIdx.set(0);
    this.navEta.set('--');
    this.following.set(true);
    this.mode.set('navigation');
    this.chat.start(vehicle.tripId);
    this.startWatchingPosition(true);

    this.vehicleService.getAll(vehicle.tripId).subscribe((vs) => {
      this.trackingSvc.vehicles.set(vs);
      this.trackingSvc.start(vehicle.tripId, destLat, destLng);
    });
    this.waypointService.getByTrip(vehicle.tripId).subscribe((wps) => {
      this.navWaypoints.set(wps);
    });

    if (destLat && destLng) {
      this.drawOsrmRoute(destLat, destLng, false);
      this.calculateEta(destLat, destLng);
    }

    if (this.userLat !== 0 || this.userLng !== 0) {
      this.map.setView([this.userLat, this.userLng], 17, { animate: true, duration: 1 });
    }
  }

  // ── Audio ────────────────────────────────────────────────────
  toggleAudio(): void {
    const enabling = !this.audioEnabled();
    this.audioEnabled.set(enabling);
    if (enabling) {
      this.speak(this.currentInstruction() || 'Audio de navegación activado');
    } else {
      window.speechSynthesis?.cancel();
    }
  }

  private speak(text: string): void {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES'; utterance.rate = 1.0; utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  // ── UI helpers ───────────────────────────────────────────────
  focusSearch(): void { this.mode.set('search'); }
  blurSearch(): void  { if (!this.searchQuery()) setTimeout(() => this.mode.set('default'), 150); }

  selectSuggestion(trip: Trip): void {
    this.searchQuery.set(trip.title);
    this.setActiveTrip(trip);
    this.mode.set('default');
  }

  openTripsPanel(): void  { this.mode.set(this.mode() === 'trips' ? 'default' : 'trips'); }
  openCreateSheet(): void { this.mode.set('create-trip'); }

  selectTripFromPanel(trip: Trip): void {
    this.setActiveTrip(trip);
    this.mode.set('default');
  }

  deleteTrip(trip: Trip, event: MouseEvent): void {
    event.stopPropagation();
    if (!confirm(`¿Eliminar "${trip.title}"?`)) return;
    this.tripService.delete(trip.id).subscribe(() => {
      this.trips.update((ts) => ts.filter((t) => t.id !== trip.id));
      if (this.activeTrip()?.id === trip.id) this.deselectTrip();
    });
  }

  toggleVehiclesPanel(): void {
    this.showVehiclesPanel.update((v) => !v);
    if (this.showVehiclesPanel()) this.showRadioPanel.set(false);
  }

  toggleRadioPanel(): void {
    this.showRadioPanel.update((v) => !v);
    if (this.showRadioPanel()) { this.showVehiclesPanel.set(false); this.showChatPanel.set(false); }
  }

  toggleChatPanel(): void {
    this.showChatPanel.update((v) => !v);
    if (this.showChatPanel()) {
      this.showVehiclesPanel.set(false);
      this.showRadioPanel.set(false);
      this.chat.markRead();
    }
  }

  sendChatMessage(): void {
    const userId = this.authService.currentUser()?.userId;
    if (!userId || !this.chatInput.trim()) return;
    this.chat.send(userId, this.chatInput);
    this.chatInput = '';
  }

  isVehicleLive(vehicleId: number): boolean {
    return this.trackingSvc.liveLocations().some((l) => l.vehicleId === vehicleId);
  }

  getParticipantEta(vehicleId: number): string {
    return this.trackingSvc.participantEtas().get(vehicleId) ?? '--';
  }

  waypointProgress(): string {
    const wps = this.navWaypoints();
    return `${wps.filter((w) => w.visitedAt).length}/${wps.length || '?'}`;
  }

  trackingLabel(): string {
    const count = this.trackingSvc.liveLocations().length;
    return count > 0 ? `${count} vehículo${count > 1 ? 's' : ''} en vivo` : 'Sin vehículos';
  }

  private wpColor(type: string): string {
    return ({
      DEPARTURE: '#16a34a', DESTINATION: '#dc2626',
      STOP: '#f59e0b', POINT_OF_INTEREST: '#3730a3',
    } as Record<string, string>)[type] ?? '#555';
  }

  // ── Copiloto IA ──────────────────────────────────────────────
  toggleCopilotPanel(): void {
    this.showCopilotPanel.update((v) => !v);
    if (this.showCopilotPanel()) {
      this.showVehiclesPanel.set(false);
      this.showRadioPanel.set(false);
      this.showChatPanel.set(false);
    }
  }

  sendCopilotMessage(): void {
    const text = this.copilotInput.trim();
    if (!text || this.copilotLoading()) return;

    this.copilotMessages.update((msgs) => [...msgs, { role: 'user', text }]);
    this.copilotInput = '';
    this.copilotLoading.set(true);

    this.http.post<CopilotResponse>(
      'https://n8n.devdyd.com/webhook/copiloto-gps',
      { chatInput: text, lat: this.userLat, lng: this.userLng },
    ).pipe(
      timeout(60000),
      catchError(() => {
        this.copilotLoading.set(false);
        this.copilotMessages.update((msgs) => [
          ...msgs,
          { role: 'ai', text: 'No se pudo conectar con el asistente. Inténtalo de nuevo.' },
        ]);
        return EMPTY;
      }),
    ).subscribe((res) => {
      this.copilotLoading.set(false);

      if (!res || typeof res.tipo !== 'string') {
        this.copilotMessages.update((msgs) => [
          ...msgs, { role: 'ai', text: 'Respuesta inesperada del asistente.' },
        ]);
        return;
      }

      if (res.tipo === 'INFO') {
        const lugares = Array.isArray(res.lugares) ? res.lugares : [];
        this.copilotMessages.update((msgs) => [...msgs, { role: 'ai', text: res.mensaje, lugares }]);
        this.copilotLayer.clearLayers();
        lugares.forEach((l) => {
          L.circleMarker([l.lat, l.lng], {
            radius: 10, fillColor: '#f59e0b', color: '#fff', weight: 2, fillOpacity: 1,
          }).bindPopup(`<strong>${l.nombre}</strong>`).addTo(this.copilotLayer);
        });
        if (lugares.length > 0) {
          this.map.fitBounds(
            L.latLngBounds(lugares.map((l) => [l.lat, l.lng] as L.LatLngTuple)),
            { padding: [60, 60] },
          );
        }
      } else if (res.tipo === 'SET_ROUTE') {
        this.copilotMessages.update((msgs) => [...msgs, { role: 'ai', text: res.mensaje }]);
        if (res.destino?.lat && res.destino?.lng) {
          this.copilotLayer.clearLayers();
          this.drawOsrmRoute(res.destino.lat, res.destino.lng, true);
        }
      }
    });
  }
}
