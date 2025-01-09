import { Injectable } from '@nestjs/common';
import { LocationObject } from '../subschemas/location.schema';
import { DistanceFare, VehicleType } from '../enums';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom, map } from 'rxjs';

@Injectable()
export class VietMapService {
  constructor(private readonly httpService: HttpService) {}

  async getDistanceNDuration(
    pickup: LocationObject,
    dropoff: LocationObject,
    type: VehicleType,
  ) {
    const vehicle = type === VehicleType.BIKE ? 'motorcycle' : 'car';

    const response = await firstValueFrom(
      this.httpService.get(
        `/route?point=${pickup.coordinates[1]},${pickup.coordinates[0]}
            &point=${dropoff.coordinates[1]},${dropoff.coordinates[0]}&vehicle=${vehicle}`,
      ),
    ).then((res) => res.data);

    return {
      distance: response.paths[0].distance,
      duration: response.paths[0].time,
    };
  }

  async getMultipleDistanceNDuration(
    pickup: LocationObject,
    dropoffs: LocationObject[],
    type: VehicleType,
  ) {
    const vehicle = type === VehicleType.BIKE ? 'motorcycle' : 'car';

    const points = [
      pickup.coordinates.reverse().join(','),
      ...dropoffs.map((dropoff) => dropoff.coordinates.reverse().join(',')),
    ];

    const sources = dropoffs.map((_, index) => index + 1).join(';');

    const url = this.buildMatrixUrl({
      points,
      sources,
      destinations: '0',
      vehicle,
      apiVersion: '1.1',
    });

    const res = await firstValueFrom(this.httpService.get(url)).then(
      (res) => res.data,
    );
    return {
      distances: res.distances.flatMap((distance) => distance),
      durations: res.durations.flatMap((duration) => duration),
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
      .replace(/%3B/g, ';')
      .replace(/%26/g, '&');
    return `/matrix?${paramsString}`;
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
