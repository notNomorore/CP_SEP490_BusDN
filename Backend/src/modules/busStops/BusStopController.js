import {
  createBusStop,
  deleteBusStop,
  exportBusStopsCsv,
  getBusStopById,
  importBusStops,
  listBusStops,
  updateBusStop,
} from './BusStopService.js';
import logger from '../../utils/logger.js';

const sendServiceError = (res, error) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors,
    });
  }
  return res.error(error.message || 'Bus stop request failed');
};

export const getBusStops = async (req, res) => {
  try {
    const stops = await listBusStops(req.query);

    return res.json({
      success: true,
      message: 'Bus stops retrieved successfully',
      stops,
      total: stops.length,
      filters: {
        search: req.query.search || '',
        district: req.query.district || '',
        routeId: req.query.routeId || '',
      },
    });
  } catch (error) {
    logger.error('List bus stops error:', error);
    return res.error('Unable to load bus stops');
  }
};

export const getBusStop = async (req, res) => {
  try {
    const stop = await getBusStopById(req.params.id);
    return res.json({
      success: true,
      message: 'Bus stop retrieved successfully',
      stop,
    });
  } catch (error) {
    logger.error('Get bus stop error:', error);
    return sendServiceError(res, error);
  }
};

export const postBusStop = async (req, res) => {
  try {
    const stop = await createBusStop(req.body);
    return res.status(201).json({
      success: true,
      message: 'Bus stop created successfully',
      stop,
    });
  } catch (error) {
    logger.error('Create bus stop error:', error);
    return sendServiceError(res, error);
  }
};

export const putBusStop = async (req, res) => {
  try {
    const stop = await updateBusStop(req.params.id, req.body);
    return res.json({
      success: true,
      message: 'Bus stop updated successfully',
      stop,
    });
  } catch (error) {
    logger.error('Update bus stop error:', error);
    return sendServiceError(res, error);
  }
};

export const removeBusStop = async (req, res) => {
  try {
    const stop = await deleteBusStop(req.params.id);
    return res.json({
      success: true,
      message: 'Bus stop deleted successfully',
      stop,
    });
  } catch (error) {
    logger.error('Delete bus stop error:', error);
    return sendServiceError(res, error);
  }
};

export const importStops = async (req, res) => {
  try {
    const result = await importBusStops({
      stops: Array.isArray(req.body?.stops) ? req.body.stops : undefined,
      apiUrl: req.body?.apiUrl,
      source: req.body?.source || 'DANABUS',
    });
    return res.json({
      success: true,
      message: 'Bus stop import completed',
      ...result,
    });
  } catch (error) {
    logger.error('Import bus stops error:', error);
    return sendServiceError(res, error);
  }
};

export const syncStops = async (req, res) => {
  try {
    const result = await importBusStops({
      apiUrl: req.body?.apiUrl,
      source: req.body?.source || 'DANABUS',
    });
    return res.json({
      success: true,
      message: 'Bus stop sync completed',
      ...result,
    });
  } catch (error) {
    logger.error('Sync bus stops error:', error);
    return sendServiceError(res, error);
  }
};

export const exportStopsCsv = async (req, res) => {
  try {
    const csv = await exportBusStopsCsv(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="da-nang-bus-stops.csv"');
    return res.send(csv);
  } catch (error) {
    logger.error('Export bus stops error:', error);
    return sendServiceError(res, error);
  }
};

export default {
  getBusStops,
  getBusStop,
  postBusStop,
  putBusStop,
  removeBusStop,
  importStops,
  syncStops,
  exportStopsCsv,
};
