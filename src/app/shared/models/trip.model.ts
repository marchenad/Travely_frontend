export type TripStatus = 'PLANNED' | 'ACTIVE' | 'NAVIGATING' | 'COMPLETED' | 'CANCELLED';

export interface Trip {
  id: number;
  title: string;
  description?: string;
  destinationName: string;
  destinationLatitude: number;
  destinationLongitude: number;
  startDate?: string;
  endDate?: string;
  status: TripStatus;
  creatorId: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;   // página actual (0-based)
  size: number;
  last: boolean;
}

export interface TripRequest {
  title: string;
  description?: string;
  destinationName: string;
  destinationLatitude: number;
  destinationLongitude: number;
  creatorId: number;
}
