/**
 * Standard JSON response helpers for claims-service.
 */

function successResponse(data, message) {
  return {
    status: 'Success',
    success: true,
    message: message || '',
    data: data || {},
    timestamp: nowIso()
  };
}

function errorResponse(message, details) {
  return {
    status: 'Error',
    success: false,
    message: message || 'An error occurred.',
    details: details || {},
    timestamp: nowIso()
  };
}

function notFoundResponse(message, details) {
  return {
    status: 'Not Found',
    success: false,
    message: message || 'Not found.',
    details: details || {},
    timestamp: nowIso()
  };
}

function validationErrorResponse(errors) {
  return {
    status: 'Validation Error',
    success: false,
    message: 'Validation failed.',
    errors: errors || [],
    timestamp: nowIso()
  };
}

function notImplementedResponse_(functionName, payload) {
  return {
    status: 'Not Implemented',
    success: false,
    message: functionName + ' is stubbed for Phase 4 and has not been implemented yet.',
    functionName: functionName,
    payload: payload || {},
    timestamp: nowIso()
  };
}
