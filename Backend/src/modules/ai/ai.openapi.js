const textParameter = (name, description, required = false) => ({
  name,
  in: 'query',
  required,
  description,
  schema: {
    type: 'string',
    ...(required ? { minLength: 1 } : {}),
    maxLength: 120,
  },
});

const routeIdParameter = {
  name: 'routeId',
  in: 'path',
  required: true,
  description: 'Route ObjectId or public route number/code accepted by BusDN, for example DN01.',
  schema: {
    type: 'string',
    maxLength: 64,
    pattern: '^[A-Za-z0-9_-]+$',
  },
};

const coordinateProperties = {
  latitude: { type: 'number', format: 'double' },
  longitude: { type: 'number', format: 'double' },
};

const stopSchema = {
  type: 'object',
  properties: {
    stopId: { type: 'string' },
    name: { type: 'string' },
    stopName: { type: 'string' },
    order: { type: 'integer' },
    stopOrder: { type: 'integer' },
    estimatedOffsetMinutes: { type: 'number' },
    latitude: { type: 'number', format: 'double' },
    longitude: { type: 'number', format: 'double' },
  },
};

const routeSummarySchema = {
  type: 'object',
  properties: {
    routeId: { type: 'string' },
    routeNumber: { type: 'string' },
    routeName: { type: 'string' },
    origin: { type: 'string' },
    destination: { type: 'string' },
    distanceKm: { type: 'number' },
    estimatedDurationMinutes: { type: 'number' },
    fare: { type: 'number' },
  },
};

const routeSchema = {
  type: 'object',
  properties: {
    routeId: { type: 'string' },
    routeNumber: { type: 'string' },
    routeName: { type: 'string' },
    origin: { type: 'string' },
    destination: { type: 'string' },
    stops: {
      type: 'array',
      items: stopSchema,
    },
    directions: {
      type: 'object',
      properties: {
        OUTBOUND: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            stops: {
              type: 'array',
              items: stopSchema,
            },
          },
        },
        INBOUND: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            stops: {
              type: 'array',
              items: stopSchema,
            },
          },
        },
      },
    },
    distanceKm: { type: 'number' },
    estimatedDurationMinutes: { type: 'number' },
    fare: { type: 'number' },
    operatingHours: {
      type: 'object',
      properties: {
        firstDeparture: { type: 'string', example: '05:30' },
        lastDeparture: { type: 'string', example: '21:00' },
        frequencyMinutes: { type: 'number' },
      },
    },
    pathPoints: {
      type: 'array',
      items: {
        type: 'object',
        properties: coordinateProperties,
      },
    },
    status: { type: 'string' },
  },
};

const routeOptionSchema = {
  type: 'object',
  properties: {
    route: routeSchema,
    startStop: stopSchema,
    endStop: stopSchema,
    estimatedDurationMinutes: { type: 'number' },
    estimatedDistanceKm: { type: 'number' },
    estimatedFare: { type: 'number' },
    isRecommended: { type: 'boolean' },
  },
};

const successEnvelope = (dataSchema, messageExample) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    statusCode: { type: 'integer', example: 200 },
    message: { type: 'string', example: messageExample },
    timestamp: { type: 'string', format: 'date-time' },
    data: dataSchema,
  },
});

const errorSchema = (statusCode, messageExample) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    statusCode: { type: 'integer', example: statusCode },
    message: { type: 'string', example: messageExample },
    details: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
});

const jsonResponse = (description, schema) => ({
  description,
  content: {
    'application/json': {
      schema,
    },
  },
});

const commonErrorResponses = {
  400: jsonResponse('Bad request.', errorSchema(400, 'Invalid request')),
  422: jsonResponse('Validation failed.', errorSchema(422, 'Validation failed')),
  500: jsonResponse('Unexpected server error.', errorSchema(500, 'Internal server error')),
};

const routeSearchDataSchema = {
  type: 'object',
  properties: {
    routes: {
      type: 'array',
      items: routeSchema,
    },
    count: { type: 'integer' },
    filters: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
      },
    },
  },
};

const routeSuggestionsDataSchema = {
  type: 'object',
  properties: {
    departureLocation: { type: 'string' },
    destinationLocation: { type: 'string' },
    transportationType: { type: 'string', example: 'bus' },
    suggestions: {
      type: 'array',
      items: routeOptionSchema,
    },
    count: { type: 'integer' },
    totalMatches: { type: 'integer' },
    bestRoute: routeOptionSchema,
    alternatives: {
      type: 'array',
      items: routeOptionSchema,
    },
    criteria: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        preference: { type: 'string' },
        optimizedBy: { type: 'string' },
      },
    },
  },
};

const nearbyRoutesDataSchema = {
  type: 'object',
  properties: {
    userLocation: {
      type: 'object',
      properties: coordinateProperties,
    },
    radiusKm: { type: 'number' },
    nearbyStops: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          order: { type: 'integer' },
          latitude: { type: 'number', format: 'double' },
          longitude: { type: 'number', format: 'double' },
          distanceKm: { type: 'number' },
          route: routeSummarySchema,
        },
      },
    },
    routes: {
      type: 'array',
      items: routeSchema,
    },
    count: { type: 'integer' },
  },
};

const tripProgressStopSchema = {
  type: 'object',
  properties: {
    stopId: { type: 'string' },
    stopName: { type: 'string' },
    stopOrder: { type: 'integer' },
  },
};

const tripProgressSchema = {
  type: 'object',
  properties: {
    progressPercent: { type: 'number' },
    currentStop: { type: 'string' },
    currentStopIndex: { type: 'integer' },
    nextStop: { type: 'string' },
    totalStops: { type: 'integer' },
    estimatedRemainingTime: { type: 'string' },
    completedStops: {
      type: 'array',
      items: tripProgressStopSchema,
    },
    remainingStops: {
      type: 'array',
      items: tripProgressStopSchema,
    },
    tripStatus: { type: 'string' },
  },
};

const etaDataSchema = {
  type: 'object',
  properties: {
    route: routeSummarySchema,
    stopEtaSummary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stopId: { type: 'string' },
          stopName: { type: 'string' },
          stopOrder: { type: 'integer' },
          etaMinutes: { type: 'integer' },
          estimatedArrivalTime: { type: 'string', example: '5 min' },
          status: { type: 'string' },
        },
      },
    },
    tripProgress: {
      type: 'array',
      items: tripProgressSchema,
    },
    refreshedAt: { type: 'string', format: 'date-time' },
  },
};

const liveDataSchema = {
  type: 'object',
  properties: {
    route: routeSummarySchema,
    buses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          publicBusId: {
            type: 'string',
            description: 'Facade-generated public bus label, not an internal vehicle or trip identifier.',
            example: 'DN01-bus-1',
          },
          routeNumber: { type: 'string' },
          currentLocation: {
            type: 'object',
            properties: {
              latitude: { type: 'number', format: 'double' },
              longitude: { type: 'number', format: 'double' },
              heading: { type: 'number' },
            },
          },
          nextStop: { type: 'string' },
          estimatedArrivalTime: { type: 'string' },
          operationalStatus: { type: 'string' },
          delay: {
            type: 'object',
            properties: {
              delayDurationMinutes: { type: 'number' },
              delayReason: { type: 'string' },
              updatedEta: { type: 'string' },
            },
          },
          lastUpdated: { type: 'string', format: 'date-time' },
        },
      },
    },
    routeChange: {
      type: 'object',
      properties: {
        changeId: { type: 'string' },
        routeId: { type: 'string' },
        routeNumber: { type: 'string' },
        reasonForChange: { type: 'string' },
        changedStops: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stopName: { type: 'string' },
              changeType: { type: 'string' },
            },
          },
        },
        updatedRoutePath: { type: 'string' },
        alternativeSuggestion: { type: 'string' },
        status: { type: 'string' },
        detectedAt: { type: 'string', format: 'date-time' },
      },
    },
    count: { type: 'integer' },
    refreshedAt: { type: 'string', format: 'date-time' },
  },
};

const withNotFound = {
  ...commonErrorResponses,
  404: jsonResponse('Route not found.', errorSchema(404, 'Route not found')),
};

export const aiOpenApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'BusDN AI Passenger API',
    version: '1.0.0',
    description: 'Public, sanitized passenger-facing BusDN route APIs for Coze Cloud Plugin integration.',
  },
  servers: [
    {
      url: 'https://cp-sep490-busdn.onrender.com/api/ai',
      description: 'BusDN Render production backend',
    },
  ],
  tags: [
    {
      name: 'AI Routes',
      description: 'Sanitized public route, nearby stop, ETA, and live bus data for passenger AI assistants.',
    },
  ],
  paths: {
    '/routes/search': {
      get: {
        tags: ['AI Routes'],
        operationId: 'searchAiRoutes',
        summary: 'Search public bus routes',
        description: 'Search published BusDN routes by route text, departure stop/origin, or destination.',
        security: [],
        parameters: [
          textParameter('q', 'Free-text search over route number, route name, origin, destination, and stop names.'),
          textParameter('from', 'Departure stop or origin search text.'),
          textParameter('to', 'Destination stop or terminal search text.'),
        ],
        responses: {
          200: jsonResponse(
            'Routes matching the supplied filters.',
            successEnvelope(routeSearchDataSchema, 'AI route search completed successfully')
          ),
          ...commonErrorResponses,
        },
      },
    },
    '/routes/suggestions': {
      get: {
        tags: ['AI Routes'],
        operationId: 'suggestAiRoutes',
        summary: 'Suggest route options between two locations',
        description: 'Returns recommended and alternative bus route options using BusDN route suggestion logic.',
        security: [],
        parameters: [
          textParameter('from', 'Required departure location or stop text.', true),
          textParameter('to', 'Required destination location or stop text.', true),
          {
            name: 'preference',
            in: 'query',
            required: false,
            description: 'Route optimization preference.',
            schema: {
              type: 'string',
              enum: ['fastest', 'shortest', 'lowest-cost', 'least-traffic'],
              default: 'fastest',
            },
          },
        ],
        responses: {
          200: jsonResponse(
            'Suggested route options.',
            successEnvelope(routeSuggestionsDataSchema, 'AI route suggestions completed successfully')
          ),
          ...commonErrorResponses,
        },
      },
    },
    '/routes/nearby': {
      get: {
        tags: ['AI Routes'],
        operationId: 'findNearbyAiRoutes',
        summary: 'Find nearby route stops and routes',
        description: 'Finds route stops near a passenger latitude/longitude and returns matching public route data.',
        security: [],
        parameters: [
          {
            name: 'latitude',
            in: 'query',
            required: true,
            description: 'Passenger latitude.',
            schema: {
              type: 'number',
              format: 'double',
              minimum: -90,
              maximum: 90,
            },
          },
          {
            name: 'longitude',
            in: 'query',
            required: true,
            description: 'Passenger longitude.',
            schema: {
              type: 'number',
              format: 'double',
              minimum: -180,
              maximum: 180,
            },
          },
          {
            name: 'radiusKm',
            in: 'query',
            required: false,
            description: 'Search radius in kilometers. Defaults to 5 when omitted.',
            schema: {
              type: 'number',
              format: 'double',
              minimum: 0,
              maximum: 50,
              default: 5,
            },
          },
        ],
        responses: {
          200: jsonResponse(
            'Nearby route stops and routes.',
            successEnvelope(nearbyRoutesDataSchema, 'AI nearby routes fetched successfully')
          ),
          ...commonErrorResponses,
        },
      },
    },
    '/routes/{routeId}/eta': {
      get: {
        tags: ['AI Routes'],
        operationId: 'getAiRouteEta',
        summary: 'Get route stop ETAs',
        description: 'Returns sanitized stop ETA and public trip progress for a route.',
        security: [],
        parameters: [routeIdParameter],
        responses: {
          200: jsonResponse(
            'Public ETA data for the route.',
            successEnvelope(etaDataSchema, 'AI route ETA fetched successfully')
          ),
          ...withNotFound,
        },
      },
    },
    '/routes/{routeId}/live': {
      get: {
        tags: ['AI Routes'],
        operationId: 'getAiRouteLive',
        summary: 'Get sanitized live bus locations for a route',
        description: 'Returns public live bus location and operational status without staff, plate, vehicle, or internal trip identifiers.',
        security: [],
        parameters: [routeIdParameter],
        responses: {
          200: jsonResponse(
            'Public live bus location data for the route.',
            successEnvelope(liveDataSchema, 'AI live route data fetched successfully')
          ),
          ...withNotFound,
        },
      },
    },
  },
};

export default aiOpenApiSpec;
