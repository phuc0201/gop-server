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
    const vehicle = type;

    const response = await firstValueFrom(
      this.httpService.get(
        `/Direction?origin=${origin.coordinates[1]},${origin.coordinates[0]}&destination=${destination.coordinates[1]},${destination.coordinates[0]}&vehicle=${vehicle}`,
      ),
    ).then((res) => res.data);

    return {
      distance: response.routes[0].legs[0].distance.value,
      duration: response.routes[0].legs[0].duration.value,
    };
  }

  async getMultipleDistanceNDuration(
    origins: LocationObject[],
    destinations: LocationObject[],
    type: VehicleType,
  ) {
    const vehicle = type;

    const url = this.buildMatrixUrl({
      origins,
      destinations,
      vehicle,
    });

    const res = await firstValueFrom(this.httpService.get(url)).then(
      (res) => res.data,
    );

    return res.rows;
  }

  private buildMatrixUrl(config: {
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
