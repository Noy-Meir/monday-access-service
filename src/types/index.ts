export interface MondayApiResponse<T = unknown> {
  data: T;
  errors?: { message: string }[];
}

export interface ApiError {
  status: number;
  message: string;
}
