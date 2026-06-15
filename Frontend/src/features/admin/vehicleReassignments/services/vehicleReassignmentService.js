import apiClient from '../../../../shared/services/apiClient.js';

const normalizeParams = (params = {}) => Object.entries(params).reduce((result, [key, value]) => {
  if (value !== undefined && value !== null && value !== '') {
    result[key] = value;
  }
  return result;
}, {});

export const vehicleReassignmentService = {
  getCandidates(params = {}) {
    return apiClient.get('/admin/vehicles/replacement-candidates', { params: normalizeParams(params) });
  },

  assignReplacementVehicle(tripId, payload) {
    return apiClient.patch(`/admin/trips/${tripId}/assign-replacement-vehicle`, payload);
  },
};

export default vehicleReassignmentService;
