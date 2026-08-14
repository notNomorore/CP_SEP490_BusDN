const jsonContent = {
  'application/json': {
    schema: {
      $ref: '#/components/schemas/ErrorResponse',
    },
  },
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
      url: 'https://cp-sep490-busdn.onrender.com',
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
    '/api/ai/routes/search': {
      get: {
        tags: ['AI Routes'],
        operationId: 'searchAiRoutes',
        summary: 'Search public bus routes',
        description: 'Search published BusDN routes by free-text route query, departure, or destination.',
        security: [],
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: false,
            description: 'Free-text search over route number, route name, origin, destination, and stop names.',
            schema: {
              type: 'string',
              maxLength: 120,
            },
          },
          {
            name: 'from',
            in: 'query',
            required: false,
            description: 'Departure stop or origin search text.',
            schema: {
              type: 'string',
              maxLength: 120,
            },
          },
          {
            name: 'to',
            in: 'query',
            required: false,
            description: 'Destination stop or terminal search text.',
            schema: {
              type: 'string',
              maxLength: 120,
            },
          },
        ],
        responses: {
          200: {
            description: 'Routes matching the supplied filters.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessEnvelope' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/RouteSearchData' },
                      },
                    },
                  ],
                },
              },
            },
          },
          422: {
            description: 'Invalid query parameters.',
            content: jsonContent,
          },
          500: {
            description: 'Unexpected server error.',
            content: jsonContent,
          },
        },
      },
    },
    '/api/ai/routes/suggestions': {
      get: {
        tags: ['AI Routes'],
        operationId: 'suggestAiRoutes',
        summary: 'Suggest route options between two locations',
        description: 'Returns recommended and alternative bus route options using the existing BusDN route suggestion logic.',
        security: [],
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: true,
            description: 'Required departure location or stop text.',
            schema: {
              type: 'string',
              minLength: 1,
              maxLength: 120,
            },
          },
          {
            name: 'to',
            in: 'query',
            required: true,
            description: 'Required destination location or stop text.',
            schema: {
              type: 'string',
              minLength: 1,
              maxLength: 120,
            },
          },
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
          200: {
            description: 'Suggested route options.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessEnvelope' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/RouteSuggestionsData' },
                      },
                    },
                  ],
                },
              },
            },
          },
          422: {
            description: 'Invalid query parameters.',
            content: jsonContent,
          },
          500: {
            description: 'Unexpected server error.',
            content: jsonContent,
          },
        },
      },
    },
    '/api/ai/routes/nearby': {
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
              exclusiveMinimum: true,
              minimum: 0,
              maximum: 50,
              default: 5,
            },
          },
        ],
        responses: {
          200: {
            description: 'Nearby route stops and routes.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessEnvelope' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/NearbyRoutesData' },
                      },
                    },
                  ],
                },
              },
            },
          },
          422: {
            description: 'Invalid query parameters.',
            content: jsonContent,
          },
          500: {
            description: 'Unexpected server error.',
            content: jsonContent,
          },
        },
      },
    },
    '/api/ai/routes/{routeId}/eta': {
      get: {
        tags: ['AI Routes'],
        operationId: 'getAiRouteEta',
        summary: 'Get route stop ETAs',
        description: 'Returns sanitized stop ETA and public trip progress for a route.',
        security: [],
        parameters: [
          {
            name: 'routeId',
            in: 'path',
            required: true,
            description: 'Route ObjectId or route number/code accepted by the existing BusDN route service.',
            schema: {
              type: 'string',
              maxLength: 64,
              pattern: '^[A-Za-z0-9_-]+$',
            },
          },
        ],
        responses: {
          200: {
            description: 'Public ETA data for the route.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessEnvelope' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/RouteEtaData' },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: 'Route not found.',
            content: jsonContent,
          },
          422: {
            description: 'Invalid routeId path parameter.',
            content: jsonContent,
          },
          500: {
            description: 'Unexpected server error.',
            content: jsonContent,
          },
        },
      },
    },
    '/api/ai/routes/{routeId}/live': {
      get: {
        tags: ['AI Routes'],
        operationId: 'getAiRouteLive',
        summary: 'Get sanitized live bus locations for a route',
        description: 'Returns public live bus location and operational status for a route without staff, plate, vehicle, or internal trip identifiers.',
        security: [],
        parameters: [
          {
            name: 'routeId',
            in: 'path',
            required: true,
            description: 'Route ObjectId or route number/code accepted by the existing BusDN route service.',
            schema: {
              type: 'string',
              maxLength: 64,
              pattern: '^[A-Za-z0-9_-]+$',
            },
          },
        ],
        responses: {
          200: {
            description: 'Public live bus location data for the route.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessEnvelope' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/RouteLiveData' },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: {
            description: 'Route not found.',
            content: jsonContent,
          },
          422: {
            description: 'Invalid routeId path parameter.',
            content: jsonContent,
          },
          500: {
            description: 'Unexpected server error.',
            content: jsonContent,
          },
        },
      },
    },
  },
  components: {
    schemas: {
      SuccessEnvelope: {
        type: 'object',
        required: ['success', 'statusCode', 'message', 'timestamp', 'data'],
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          statusCode: {
            type: 'integer',
            example: 200,
          },
          message: {
            type: 'string',
            example: 'AI route search completed successfully',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'statusCode', 'message', 'timestamp'],
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          statusCode: {
            type: 'integer',
            example: 422,
          },
          message: {
            type: 'string',
            example: 'Validation failed',
          },
          details: {
            oneOf: [
              {
                type: 'object',
                additionalProperties: {
                  type: 'string',
                },
              },
              {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            ],
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Coordinate: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          latitude: {
            type: 'number',
            format: 'double',
            nullable: true,
          },
          longitude: {
            type: 'number',
            format: 'double',
            nullable: true,
          },
        },
      },
      RouteStop: {
        type: 'object',
        required: ['name', 'order', 'latitude', 'longitude'],
        properties: {
          stopId: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          order: {
            type: 'integer',
            nullable: true,
          },
          estimatedOffsetMinutes: {
            type: 'number',
            nullable: true,
          },
          latitude: {
            type: 'number',
            format: 'double',
            nullable: true,
          },
          longitude: {
            type: 'number',
            format: 'double',
            nullable: true,
          },
        },
      },
      RouteDirection: {
        type: 'object',
        required: ['label', 'stops'],
        properties: {
          label: {
            type: 'string',
          },
          stops: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/RouteStop',
            },
          },
        },
      },
      RouteDirections: {
        type: 'object',
        properties: {
          OUTBOUND: {
            $ref: '#/components/schemas/RouteDirection',
          },
          INBOUND: {
            $ref: '#/components/schemas/RouteDirection',
          },
        },
      },
      OperatingHours: {
        type: 'object',
        properties: {
          firstDeparture: {
            type: 'string',
            example: '05:30',
          },
          lastDeparture: {
            type: 'string',
            example: '21:00',
          },
          frequencyMinutes: {
            type: 'number',
          },
        },
      },
      PublicRoute: {
        type: 'object',
        required: ['routeId', 'routeNumber', 'routeName', 'origin', 'destination', 'stops'],
        properties: {
          routeId: {
            type: 'string',
          },
          routeNumber: {
            type: 'string',
          },
          routeName: {
            type: 'string',
          },
          origin: {
            type: 'string',
          },
          destination: {
            type: 'string',
          },
          stops: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/RouteStop',
            },
          },
          directions: {
            $ref: '#/components/schemas/RouteDirections',
          },
          distanceKm: {
            type: 'number',
          },
          estimatedDurationMinutes: {
            type: 'number',
          },
          fare: {
            type: 'number',
          },
          operatingHours: {
            $ref: '#/components/schemas/OperatingHours',
          },
          pathPoints: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Coordinate',
            },
          },
          status: {
            type: 'string',
          },
        },
      },
      PublicRouteSummary: {
        type: 'object',
        required: ['routeId', 'routeNumber', 'routeName', 'origin', 'destination'],
        properties: {
          routeId: {
            type: 'string',
          },
          routeNumber: {
            type: 'string',
          },
          routeName: {
            type: 'string',
          },
          origin: {
            type: 'string',
          },
          destination: {
            type: 'string',
          },
          distanceKm: {
            type: 'number',
          },
          estimatedDurationMinutes: {
            type: 'number',
          },
          fare: {
            type: 'number',
          },
        },
      },
      RouteSearchData: {
        type: 'object',
        required: ['routes', 'count', 'filters'],
        properties: {
          routes: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PublicRoute',
            },
          },
          count: {
            type: 'integer',
          },
          filters: {
            type: 'object',
            required: ['q', 'from', 'to'],
            properties: {
              q: {
                type: 'string',
              },
              from: {
                type: 'string',
              },
              to: {
                type: 'string',
              },
            },
          },
        },
      },
      RouteOption: {
        type: 'object',
        required: ['route', 'startStop', 'endStop', 'estimatedDurationMinutes', 'estimatedDistanceKm', 'estimatedFare', 'isRecommended'],
        properties: {
          route: {
            $ref: '#/components/schemas/PublicRoute',
          },
          startStop: {
            allOf: [{ $ref: '#/components/schemas/RouteStop' }],
            nullable: true,
          },
          endStop: {
            allOf: [{ $ref: '#/components/schemas/RouteStop' }],
            nullable: true,
          },
          estimatedDurationMinutes: {
            type: 'number',
          },
          estimatedDistanceKm: {
            type: 'number',
          },
          estimatedFare: {
            type: 'number',
          },
          isRecommended: {
            type: 'boolean',
          },
        },
      },
      RouteSuggestionsData: {
        type: 'object',
        required: ['departureLocation', 'destinationLocation', 'transportationType', 'suggestions', 'count', 'totalMatches', 'bestRoute', 'alternatives', 'criteria'],
        properties: {
          departureLocation: {
            type: 'string',
          },
          destinationLocation: {
            type: 'string',
          },
          transportationType: {
            type: 'string',
            example: 'bus',
          },
          suggestions: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/RouteOption',
            },
          },
          count: {
            type: 'integer',
          },
          totalMatches: {
            type: 'integer',
          },
          bestRoute: {
            allOf: [{ $ref: '#/components/schemas/RouteOption' }],
            nullable: true,
          },
          alternatives: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/RouteOption',
            },
          },
          criteria: {
            type: 'object',
            nullable: true,
            properties: {
              from: {
                type: 'string',
              },
              to: {
                type: 'string',
              },
              preference: {
                type: 'string',
              },
              optimizedBy: {
                type: 'string',
              },
            },
          },
        },
      },
      UserLocation: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          latitude: {
            type: 'number',
            format: 'double',
          },
          longitude: {
            type: 'number',
            format: 'double',
          },
        },
      },
      NearbyStop: {
        type: 'object',
        required: ['name', 'order', 'latitude', 'longitude', 'distanceKm', 'route'],
        properties: {
          name: {
            type: 'string',
          },
          order: {
            type: 'integer',
            nullable: true,
          },
          latitude: {
            type: 'number',
            format: 'double',
            nullable: true,
          },
          longitude: {
            type: 'number',
            format: 'double',
            nullable: true,
          },
          distanceKm: {
            type: 'number',
          },
          route: {
            $ref: '#/components/schemas/PublicRouteSummary',
          },
        },
      },
      NearbyRoutesData: {
        type: 'object',
        required: ['userLocation', 'radiusKm', 'nearbyStops', 'routes', 'count'],
        properties: {
          userLocation: {
            $ref: '#/components/schemas/UserLocation',
          },
          radiusKm: {
            type: 'number',
          },
          nearbyStops: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/NearbyStop',
            },
          },
          routes: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PublicRoute',
            },
          },
          count: {
            type: 'integer',
          },
        },
      },
      StopEta: {
        type: 'object',
        required: ['stopName', 'stopOrder', 'etaMinutes', 'estimatedArrivalTime', 'status'],
        properties: {
          stopId: {
            type: 'string',
          },
          stopName: {
            type: 'string',
          },
          stopOrder: {
            type: 'integer',
            nullable: true,
          },
          etaMinutes: {
            type: 'integer',
            nullable: true,
          },
          estimatedArrivalTime: {
            type: 'string',
            example: '5 min',
          },
          status: {
            type: 'string',
          },
        },
      },
      TripProgressStop: {
        type: 'object',
        required: ['stopName', 'stopOrder'],
        properties: {
          stopId: {
            type: 'string',
          },
          stopName: {
            type: 'string',
          },
          stopOrder: {
            type: 'integer',
            nullable: true,
          },
        },
      },
      PublicTripProgress: {
        type: 'object',
        required: ['progressPercent', 'currentStop', 'currentStopIndex', 'nextStop', 'totalStops', 'estimatedRemainingTime', 'completedStops', 'remainingStops', 'tripStatus'],
        properties: {
          progressPercent: {
            type: 'number',
          },
          currentStop: {
            type: 'string',
          },
          currentStopIndex: {
            type: 'integer',
            nullable: true,
          },
          nextStop: {
            type: 'string',
          },
          totalStops: {
            type: 'integer',
            nullable: true,
          },
          estimatedRemainingTime: {
            type: 'string',
          },
          completedStops: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TripProgressStop',
            },
          },
          remainingStops: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TripProgressStop',
            },
          },
          tripStatus: {
            type: 'string',
          },
        },
      },
      RouteEtaData: {
        type: 'object',
        required: ['route', 'stopEtaSummary', 'tripProgress', 'refreshedAt'],
        properties: {
          route: {
            $ref: '#/components/schemas/PublicRouteSummary',
          },
          stopEtaSummary: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/StopEta',
            },
          },
          tripProgress: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PublicTripProgress',
            },
          },
          refreshedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      PublicLocation: {
        allOf: [
          { $ref: '#/components/schemas/Coordinate' },
          {
            type: 'object',
            properties: {
              heading: {
                type: 'number',
                nullable: true,
              },
            },
          },
        ],
      },
      PublicBus: {
        type: 'object',
        required: ['publicBusId', 'routeNumber', 'currentLocation', 'nextStop', 'estimatedArrivalTime', 'operationalStatus', 'delay', 'lastUpdated'],
        properties: {
          publicBusId: {
            type: 'string',
            description: 'Facade-generated public bus label, not an internal vehicle or trip identifier.',
            example: 'DN01-bus-1',
          },
          routeNumber: {
            type: 'string',
          },
          currentLocation: {
            allOf: [{ $ref: '#/components/schemas/PublicLocation' }],
            nullable: true,
          },
          nextStop: {
            type: 'string',
          },
          estimatedArrivalTime: {
            type: 'string',
          },
          operationalStatus: {
            type: 'string',
          },
          delay: {
            allOf: [{ $ref: '#/components/schemas/PublicDelay' }],
            nullable: true,
          },
          lastUpdated: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },
      PublicDelay: {
        type: 'object',
        required: ['delayDurationMinutes', 'delayReason', 'updatedEta'],
        properties: {
          delayDurationMinutes: {
            type: 'number',
          },
          delayReason: {
            type: 'string',
          },
          updatedEta: {
            type: 'string',
          },
        },
      },
      RouteChangeNotice: {
        type: 'object',
        nullable: true,
        required: ['changeId', 'routeId', 'routeNumber', 'reasonForChange', 'changedStops', 'updatedRoutePath', 'alternativeSuggestion', 'status', 'detectedAt'],
        properties: {
          changeId: {
            type: 'string',
          },
          routeId: {
            type: 'string',
          },
          routeNumber: {
            type: 'string',
          },
          reasonForChange: {
            type: 'string',
          },
          changedStops: {
            type: 'array',
            items: {
              type: 'object',
              required: ['stopName', 'changeType'],
              properties: {
                stopName: {
                  type: 'string',
                },
                changeType: {
                  type: 'string',
                },
              },
            },
          },
          updatedRoutePath: {
            type: 'string',
          },
          alternativeSuggestion: {
            type: 'string',
          },
          status: {
            type: 'string',
          },
          detectedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },
      RouteLiveData: {
        type: 'object',
        required: ['route', 'buses', 'routeChange', 'count', 'refreshedAt'],
        properties: {
          route: {
            $ref: '#/components/schemas/PublicRouteSummary',
          },
          buses: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PublicBus',
            },
          },
          routeChange: {
            allOf: [{ $ref: '#/components/schemas/RouteChangeNotice' }],
            nullable: true,
          },
          count: {
            type: 'integer',
          },
          refreshedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
};

export default aiOpenApiSpec;
