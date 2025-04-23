import { Injectable } from '@nestjs/common';
import { LocationObject } from '../subschemas/location.schema';
import { DistanceFare, VehicleType } from '../enums';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map } from 'rxjs';

@Injectable()
export class VietMapService {
  constructor(private readonly httpService: HttpService) {}

  async getDistanceNDuration(
    origin: LocationObject,
    destination: LocationObject,
    type: VehicleType,
  ) {
    const vehicle = type === VehicleType.BIKE ? 'motorcycle' : 'car';

    const response = await firstValueFrom(
      this.httpService.get(
        `/route?api-version=1.1&point=${origin.coordinates[1]},${origin.coordinates[0]}&point=${destination.coordinates[1]},${destination.coordinates[0]}&vehicle=${vehicle}`,
      ),
    ).then((res) => res.data);

    return {
      distance: response.paths[0].distance,
      duration: response.paths[0].time / 1000,
    };
  }

  async getMultipleDistanceNDuration(
    destinations: LocationObject,
    origins: LocationObject[],
    type: VehicleType,
  ) {
    const vehicle = type === VehicleType.BIKE ? 'motorcycle' : 'car';
    const pickup = origins.map((or) => {
      return {
        ...or,
        coordinates: [or.coordinates[1], or.coordinates[0]],
      };
    });
    const dropoff = [destinations.coordinates[1], destinations.coordinates[0]];
    const points = [
      dropoff.join(','),
      ...pickup.map((pickup) => pickup.coordinates.join(',')),
    ];

    const sources = origins.map((_, index) => index + 1).join(';');

    const url = this.buildMatrixUrl({
      points,
      sources: sources,
      destinations: '0',
      vehicle,
      apiVersion: '1.1',
    });

    const res = await firstValueFrom(this.httpService.get(url)).then(
      (res) => res.data,
    );

    return {
      distances: res.distances,
      durations: res.durations,
    };
  }

  private buildMatrixUrl(config: {
    points: string[];
    sources: string;
    destinations: string;
    vehicle: string;
    apiVersion: string;
  }) {
    const params = new URLSearchParams();
    params.append('api-version', config.apiVersion);

    config.points.forEach((point) => {
      params.append('point', point);
    });

    params.append('sources', config.sources);
    params.append('destinations', config.destinations);
    params.append('points_encoded', 'false');
    params.append('vehicle', config.vehicle);

    const paramsString = params
      .toString()
      .replace(/%2C/g, ',')
      .replace(/%3D/g, '=')
      .replace(/%26/g, '&');

    return `/matrix?${paramsString}`;
  }

  async getMultipleDistanceNDurationForGOONG(
    origins: LocationObject[],
    destinations: LocationObject[],
    type: VehicleType,
  ) {
    const vehicle = type;

    const url = this.buildMatrixUrlForGOONG({
      origins,
      destinations,
      vehicle,
    });

    const res = await firstValueFrom(this.httpService.get(url)).then(
      (res) => res.data,
    );

    return res.rows;
  }

  private buildMatrixUrlForGOONG(config: {
    origins: LocationObject[];
    destinations: LocationObject[];
    vehicle: string;
  }) {
    const params = new URLSearchParams();
    params.append(
      'origins',
      config.origins
        .map((loc) => `${loc.coordinates[1]},${loc.coordinates[0]}`)
        .join('|'),
    );
    params.append(
      'destinations',
      config.destinations
        .map((loc) => `${loc.coordinates[1]},${loc.coordinates[0]}`)
        .join('|'),
    );
    params.append('vehicle', config.vehicle);

    return `/DistanceMatrix?${params}`;
  }

  calculateFare(distance: number, type: DistanceFare): number {
    distance = Math.round(distance / 1000);
    if (distance <= 2) {
      return distance * type.First2Km;
    } else if (distance <= 10) {
      return 12000 + (distance - 2) * type.Next8Km;
    } else {
      return 52000 + (distance - 10) * type.Over10Km;
    }
  }
}
