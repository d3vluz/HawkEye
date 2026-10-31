import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface CvImageInput {
  filename: string;
  storage_path: string;
  sha256: string;
  timestamp: string;
}

export interface CvImageResult {
  filename: string;
  sha256: string;
  timestamp: string;
  original_url: string;
  areas_url: string;
  pins_url: string;
  boxes_url: string;
  shafts_url: string;
  areas_count: number;
  pins_count: number;
  boxes_info: Record<string, unknown>;
  pin_classification: Record<string, unknown>;
  shaft_classification: Record<string, unknown>;
}

@Injectable()
export class CvWorkerService {
  private workerUrl: string;

  constructor(
    private http: HttpService,
    private config: ConfigService,
  ) {
    this.workerUrl = config.get<string>('CV_WORKER_URL', 'http://worker:8000');
  }

  async process(images: CvImageInput[]): Promise<{ processed_count: number; results: CvImageResult[] }> {
    const { data } = await firstValueFrom(
      this.http.post(`${this.workerUrl}/process`, { images }),
    );
    return data;
  }
}
