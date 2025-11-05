// powerDiagram.js - computePowerDiagramIntegrated() and subroutines
import {polygonCentroid, polygonHull, polygonLength} from 'd3-polygon';
import {epsilon} from './utils';
import {ConvexHull} from './convexHull';
import {polygonClip} from './d3-polygon-clip';

// IN: HEdge edge
function getFacesOfDestVertex(edge) {
    var faces = [];
    var previous = edge;
    var first = edge.dest;
    var site = first.originalObject;
    var neighbours = [];
    var neighboursAll = [];
    var links = [];
    do {
        previous = previous.twin.prev;
        var siteOrigin = previous.orig.originalObject;
        var iFace = previous.iFace;
        if (!siteOrigin.isDummy) {
            neighbours.push(siteOrigin);
            neighboursAll.push(siteOrigin)
            if (iFace.isVisibleFromBelow()) {
                links.push(iFace);
            } else {
                links.push(-1);
            }
        } else {
            neighboursAll.push(-1)
            if (iFace.isVisibleFromBelow()) {
                links.push(iFace);
            } else {
                links.push(-1);
            }
        }
        if (iFace.isVisibleFromBelow()) {
            faces.push(iFace);
        }
    } while (previous !== edge);
    site.neighbours = neighbours
    site.neighboursAll = neighboursAll;
    site.links = links;
    return faces;
}

// IN: Omega = convex bounding polygon
// IN: S = unique set of sites with weights
// OUT: Set of lines making up the voronoi power diagram
export function computePowerDiagramIntegrated(sites, boundingSites, clippingPolygon) {
    var convexHull = new ConvexHull();
    convexHull.clear();
    convexHull.init(boundingSites, sites);
    var facets;
    try {
        facets = convexHull.compute(sites);
    } catch (error) {
        console.log("Cannot compute Convex Hull")
        throw new d3WeightedVoronoiError('Cannot compute Convex Hull');
    }
    // var facets = convexHull.compute(sites);
    var polygons = [];
    var verticesVisited = [];
    var facetCount = facets.length;

    for (var i = 0; i < facetCount; i++) {
        var facet = facets[i];
        if (facet.isVisibleFromBelow()) {
            for (var e = 0; e < 3; e++) {
                // go through the edges and start to build the polygon by going through the double connected edge list
                var edge = facet.edges[e];
                var destVertex = edge.dest;
                var site = destVertex.originalObject;

                if (!verticesVisited[destVertex.index]) {
                    verticesVisited[destVertex.index] = true;
                    if (site.isDummy) {
                        // Check if this is one of the sites making the bounding polygon
                        continue;
                    }
                    // faces around the vertices which correspond to the polygon corner points
                    var faces = getFacesOfDestVertex(edge)
                    var protopoly = [];
                    var lastX = null;
                    var lastY = null;
                    var dx = 1;
                    var dy = 1;
                    for (var j = 0; j < faces.length; j++) {
                        var point = faces[j].getDualPoint();
                        var x1 = point.x;
                        var y1 = point.y;
                        if (lastX !== null) {
                            dx = lastX - x1;
                            dy = lastY - y1;
                            if (dx < 0) {
                                dx = -dx;
                            }
                            if (dy < 0) {
                                dy = -dy;
                            }
                        }
                        if (dx > epsilon || dy > epsilon) {
                            protopoly.push([x1, y1]);
                            lastX = x1;
                            lastY = y1;
                            if (site.hasOwnProperty('edgeList')) {
                                site.edgeList.push([x1, y1])
                                site.edgeListVertex.push(edge.orig)
                            } else {
                                site.edgeListVertex = []
                                site.edgeListVertex.push(edge.orig)
                                site.edgeList = []
                                site.edgeList.push([x1, y1])
                            }
                        } else {
                            // console.log("not enough difference")
                        }
                    }
                    if (protopoly.length === 0) {
                        site.nonClippedPolygon = site.oldArray
                    } else {
                        site.nonClippedPolygon = protopoly.reverse()
                        site.oldArray = [...protopoly]
                        site.neighboursAll.reverse();
                    }
                    if (!site.isDummy && polygonLength(site.nonClippedPolygon) > 0) {
                        if (site.nonClippedPolygon.length === 0) {
                            site.nonClippedPolygon = site.oldArray
                            console.log('Non-clipped Polygon has no edges');
                            // throw new d3WeightedVoronoiError('Non-clipped Polygon has no edges');
                        }
                        var clippedPoly = polygonClip(clippingPolygon, site.nonClippedPolygon, site);
                        if (clippedPoly.length === 0) {
                            clippedPoly = site.oldArray
                            console.log('Clipped Polygon has no edges');
                            // throw new d3WeightedVoronoiError('Clipped Polygon has no edges');
                        }
                        site.hull = polygonHull(clippedPoly);
                        if (site.hull === 0 || site.hull === undefined) {
                            console.log('Hull is zero');
                            site.hull = site.oldArray
                            // throw new d3WeightedVoronoiError('Hull is zero');
                        }
                        if (site.hull === null || site === undefined) {
                            console.log(site);
                            throw new d3WeightedVoronoiError('Hull is zero');
                        }
                        site.polygon = clippedPoly;
                        site.centroid = polygonCentroid(site.hull);
                        clippedPoly.site = site;
                        if (clippedPoly.length > 0) {
                            polygons.push(clippedPoly);
                        }
                    }
                }
            }
        }
    }
    return polygons;
}
