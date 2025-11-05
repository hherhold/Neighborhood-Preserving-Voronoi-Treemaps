export function polygonClip(clip, subject, siteObj) {
    // Version 0.0.0. Copyright 2017 Mike Bostock.

    // Clips the specified subject polygon to the specified clip polygon;
    // requires the clip polygon to be counterclockwise and convex.
    // https://en.wikipedia.org/wiki/Sutherland–Hodgman_algorithm
    // https://observablehq.com/@d3/
    if (siteObj.neighboursAll.length !== subject.length) {
        siteObj.neighboursAll = siteObj.neighboursAll.filter((d, i) => siteObj.links[i] !== -1)
    }
    //check if the polygon is actually in the clipping polygon if(){
    // let isInsidePoly = d3Polygon.polygonContains(clip, [siteObj.x, siteObj.y])
    // if(!isInsidePoly){
    //   console.log("error, not inside polygon")
    // }
    let subjectCopy = subject.map(function (d, i) {
        let id = siteObj.neighboursAll[i] === -1 ? -1 : siteObj.neighboursAll[i].originalObject.data.originalData.data.id
        return {'id': id, 'type': 'point', 'point': d, 'data': siteObj.neighboursAll[i], 'parent': 0};
    });
    var input,
        inputCopy,
        closed = polygonClosed(subject),
        i = -1,
        n = clip.length - polygonClosed(clip),
        j,
        m,
        a = clip[n - 1],
        b,
        c,
        d,
        intersection;

    siteObj.lineList = []

    //Loop over each side
    while (++i < n) {
        input = subject.slice();
        inputCopy = subjectCopy.slice();
        subject.length = 0;
        subjectCopy.length = 0;
        b = clip[i];
        //b is the right clip point
        //a is the last clip point
        c = input[(m = input.length - closed) - 1];
        // c = input[(m = input.length - closed) - 1].point;
        j = -1;
        //loop over each line?
        while (++j < m) {
            //d is the next point from the polygon
            //c is the last point from the previous polygon clip off
            d = input[j];
            // d = input[j].point;

            if (polygonInside(d, a, b)) {
                if (!polygonInside(c, a, b)) {
                    //The next point is inside the clip, but the last point was outside
                    intersection = polygonIntersect(c, d, a, b);
                    if (isFinite(intersection[0])) {
                        subjectCopy.push({
                            'id': inputCopy[j].id,
                            'type': 'clip',
                            'point': intersection,
                            'data': inputCopy[j].data,
                            'parent': i,
                            'source': d,
                            'target': intersection
                        });
                        subject.push(intersection);
                    }
                }
                //Because the new point is inside the polygon, we have to add it regardless
                subject.push(d)
                subjectCopy.push({
                    'id': inputCopy[j].id,
                    'type': 'datapoint',
                    'point': d,
                    'data': inputCopy[j].data,
                    'parent': inputCopy[j].parent,
                    'source': a,
                    'target': b
                });
                if (subjectCopy.length > 1 && subjectCopy[subjectCopy.length - 2].id === subjectCopy[subjectCopy.length - 1].id && subjectCopy[subjectCopy.length - 1].id !== -1) {
                    // console.log("error")
                    subjectCopy[subjectCopy.length - 2] = {
                        'id': -1,
                        'type': 'parent',
                        'point': subjectCopy[subjectCopy.length - 2].point,
                        'data': -1,
                        'parent': i,
                        'source': d,
                        'target': subjectCopy[subjectCopy.length - 2].point
                    };
                }
                //instead of mapping -1 if we are on the border, we could also specify the border directly
                // 0 | 1
                //---|---
                // 3 | 2
            } else if (polygonInside(c, a, b)) {
                //If the next point is outside the clip of, but the last point was inside the clip of, we have to add a point
                intersection = polygonIntersect(c, d, a, b);
                if (isFinite(intersection[0])) {
                    subject.push(intersection)
                    subjectCopy.push({
                        'id': inputCopy[j].id,
                        'type': 'clip',
                        'point': intersection,
                        'data': inputCopy[j].data,
                        'parent': inputCopy[j].parent,
                        'source': a,
                        'target': intersection
                    });
                }

            } else if (subjectCopy.length === 0 && j - 1 === m) {
                console.log("Error, not clipping vertices")
            }
            c = d;
        }
        if (closed) {
            if (subject.length > 0) {
                subjectCopy.push({
                    'type': 'datapoint',
                    'point': subjectCopy[0].point,
                    'data': inputCopy[j].data,
                    'id': inputCopy[j].id,
                    'parent': i,
                    'source': a,
                    'target': subjectCopy[0].point
                });
                subject.push(subject[0]);
            }
        }
        a = b;
    }
    //map the subject into an points array and properties array
    // let points = subject.map(d => d.point)
    siteObj.propertiesNeighboursClipped = subjectCopy;
    // return points;
    return subject;
}

function polygonInside(p, a, b) {
    return (b[0] - a[0]) * (p[1] - a[1]) < (b[1] - a[1]) * (p[0] - a[0]);
}

// Intersect two infinite lines cd and ab.
// Return Infinity if cd and ab colinear
function polygonIntersect(c, d, a, b) {
    var x1 = c[0],
        x3 = a[0],
        x21 = d[0] - x1,
        x43 = b[0] - x3,
        y1 = c[1],
        y3 = a[1],
        y21 = d[1] - y1,
        y43 = b[1] - y3,
        ua = (x43 * (y1 - y3) - y43 * (x1 - x3)) / (y43 * x21 - x43 * y21);
    return [x1 + ua * x21, y1 + ua * y21];
}

// Returns true if the polygon is closed.
function polygonClosed(coordinates) {
    var a = coordinates[0],
        b = coordinates[coordinates.length - 1];
    return !(a[0] - b[0] || a[1] - b[1]);
}
