import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  monday: {
    apiToken: process.env.MONDAY_API_TOKEN || '',
    apiUrl: process.env.MONDAY_API_URL || 'https://api.monday.com/v2',
  },
};
