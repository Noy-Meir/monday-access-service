import axios from 'axios';
import { config } from '../config';
import { MondayApiResponse } from '../types';

async function query<T>(gqlQuery: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await axios.post<MondayApiResponse<T>>(
    config.monday.apiUrl,
    { query: gqlQuery, variables },
    {
      headers: {
        Authorization: config.monday.apiToken,
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.data.errors?.length) {
    throw new Error(response.data.errors[0].message);
  }

  return response.data.data;
}

export const mondayService = {
  query,
};
