const minutesFromWalking = (walking) => (Number(walking?.durationSeconds) || 0) / 60;

const routeServiceKey = (node) => `${node.routeId}|${node.direction}`;

export class PathFinder {
  constructor({ transitGraph, transferGraph, walkingRouting, waitingTimeService, config }) {
    this.transitGraph = transitGraph;
    this.transferGraph = transferGraph;
    this.walkingRouting = walkingRouting;
    this.waitingTimeService = waitingTimeService;
    this.config = config;
    this.walkingCache = new Map();
  }

  async findPaths({ origin, destination, originCandidates, destinationCandidates, maxTransfers }) {
    const paths = [];
    const originWalks = await this.resolveCandidateWalks(origin, originCandidates);
    const destinationWalks = await this.resolveCandidateWalks(destination, destinationCandidates);

    paths.push(...this.findDirectPaths({ originWalks, destinationWalks }));

    if (maxTransfers > 0) {
      paths.push(...this.findOneTransferPaths({ originWalks, destinationWalks }));
    }

    return this.deduplicatePaths(paths)
      .sort((left, right) => left.costMinutes - right.costMinutes);
  }

  async resolveCandidateWalks(point, candidates) {
    const result = new Map();
    for (const candidate of candidates) {
      const walking = await this.walkToStation(point, candidate.station);
      if (walking?.isAccessible === false) {
        continue;
      }

      result.set(candidate.stationId, {
        candidate,
        walking,
        durationMinutes: minutesFromWalking(walking),
      });
    }
    return result;
  }

  async walkToStation(point, station) {
    const key = [
      Number(point.latitude).toFixed(6),
      Number(point.longitude).toFixed(6),
      station.stationId,
    ].join(':');

    if (this.walkingCache.has(key)) {
      return this.walkingCache.get(key);
    }

    const walking = await this.walkingRouting.route({ from: point, to: station });
    this.walkingCache.set(key, walking);
    return walking;
  }

  findDirectPaths({ originWalks, destinationWalks }) {
    const paths = [];

    for (const originWalk of originWalks.values()) {
      for (const destinationWalk of destinationWalks.values()) {
        for (const originNode of originWalk.candidate.nodes) {
          for (const destinationNode of destinationWalk.candidate.nodes) {
            if (
              routeServiceKey(originNode) !== routeServiceKey(destinationNode)
              || originNode.stopOrder >= destinationNode.stopOrder
            ) {
              continue;
            }

            const busSegment = this.transitGraph.getSegment(originNode, destinationNode);
            if (!busSegment) {
              continue;
            }

            const wait = this.waitingTimeService.getWaitingTimeMinutes({
              routeId: originNode.routeId,
              direction: originNode.direction,
              stop: originNode.stop,
              route: originNode.route,
            });

            paths.push(this.buildPath({
              originWalk,
              destinationWalk,
              busLegs: [{ fromNode: originNode, toNode: destinationNode, segment: busSegment, wait }],
              transferLeg: null,
            }));
          }
        }
      }
    }

    return paths;
  }

  findOneTransferPaths({ originWalks, destinationWalks }) {
    const paths = [];

    for (const originWalk of originWalks.values()) {
      for (const originNode of originWalk.candidate.nodes) {
        const alightOptions = this.transitGraph
          .getDownstreamStops(originNode)
          .filter((node) => this.transferGraph.getEdges(node.key).length)
          .slice(0, this.config.MAX_TRANSFER_ALIGHT_OPTIONS_PER_ORIGIN);

        for (const alightNode of alightOptions) {
          const firstSegment = this.transitGraph.getSegment(originNode, alightNode);
          if (!firstSegment) {
            continue;
          }

          for (const transferEdge of this.transferGraph.getEdges(alightNode.key)) {
            const boardNode = this.transitGraph.nodes.get(transferEdge.toKey);
            if (!boardNode) {
              continue;
            }

            for (const destinationWalk of destinationWalks.values()) {
              for (const destinationNode of destinationWalk.candidate.nodes) {
                if (
                  routeServiceKey(boardNode) !== routeServiceKey(destinationNode)
                  || boardNode.stopOrder >= destinationNode.stopOrder
                ) {
                  continue;
                }

                const secondSegment = this.transitGraph.getSegment(boardNode, destinationNode);
                if (!secondSegment) {
                  continue;
                }

                const firstWait = this.waitingTimeService.getWaitingTimeMinutes({
                  routeId: originNode.routeId,
                  direction: originNode.direction,
                  stop: originNode.stop,
                  route: originNode.route,
                });
                const secondWait = this.waitingTimeService.getWaitingTimeMinutes({
                  routeId: boardNode.routeId,
                  direction: boardNode.direction,
                  stop: boardNode.stop,
                  route: boardNode.route,
                });

                paths.push(this.buildPath({
                  originWalk,
                  destinationWalk,
                  busLegs: [
                    { fromNode: originNode, toNode: alightNode, segment: firstSegment, wait: firstWait },
                    { fromNode: boardNode, toNode: destinationNode, segment: secondSegment, wait: secondWait },
                  ],
                  transferLeg: transferEdge,
                }));
              }
            }
          }
        }
      }
    }

    return paths;
  }

  buildPath({ originWalk, destinationWalk, busLegs, transferLeg }) {
    const waitMinutes = busLegs.reduce((total, leg) => total + leg.wait.durationMinutes, 0);
    const busMinutes = busLegs.reduce((total, leg) => total + leg.segment.durationMinutes, 0);
    const transferMinutes = transferLeg ? transferLeg.durationMinutes + this.config.TRANSFER_PENALTY_MINUTES : 0;
    const walkingMinutes = originWalk.durationMinutes + destinationWalk.durationMinutes + (transferLeg?.durationMinutes || 0);
    const costMinutes = waitMinutes + busMinutes + walkingMinutes + transferMinutes;

    return {
      costMinutes,
      transferCount: Math.max(busLegs.length - 1, 0),
      originWalk,
      destinationWalk,
      busLegs,
      transferLeg,
      signature: this.buildSignature({ originWalk, destinationWalk, busLegs, transferLeg }),
    };
  }

  buildSignature({ originWalk, destinationWalk, busLegs, transferLeg }) {
    return [
      originWalk.candidate.stationId,
      ...busLegs.flatMap((leg) => [
        leg.fromNode.routeCode,
        leg.fromNode.direction,
        leg.fromNode.stationId,
        leg.toNode.stationId,
      ]),
      transferLeg ? `${transferLeg.fromStation.stationId}>${transferLeg.toStation.stationId}` : 'direct',
      destinationWalk.candidate.stationId,
    ].join('|');
  }

  deduplicatePaths(paths) {
    const seen = new Set();
    return paths.filter((path) => {
      if (seen.has(path.signature)) {
        return false;
      }
      seen.add(path.signature);
      return true;
    });
  }
}

export default PathFinder;
