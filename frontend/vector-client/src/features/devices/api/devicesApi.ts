import { identityHttpClient } from '../../../shared/api/httpClient';
import type { ActiveDeviceResponseDto } from '../../../shared/types/api';

export async function getActiveAccountDevices(accountId: string): Promise<ActiveDeviceResponseDto[]> {
  const response = await identityHttpClient.get<ActiveDeviceResponseDto[]>(`/api/v1/devices/accounts/${accountId}/active`);
  return response.data;
}

export async function revokeCurrentAccountDevice(deviceId: string): Promise<void> {
  await identityHttpClient.delete(`/api/v1/devices/${deviceId}`);
}
