//https://gist.github.com/axelpale/3118596
//https://stackoverflow.com/questions/43241174/javascript-generating-all-combinations-of-elements-in-a-single-array-in-pairs
import * as fs from "fs";
import {point, Segment, segment} from "@flatten-js/core";

/////////////////////////////////
/// General Helper Functions ////
/////////////////////////////////

export const isOdd = (num) => num % 2;

export const isEven = (num) => isOdd(num) ? 0 : 1;

const k_combinations = (set, k) => {
    if (k > set.length || k <= 0) {
        return [];
    }

    if (k === set.length) {
        return [set];
    }

    if (k === 1) {
        return set.reduce((acc, cur) => [...acc, [cur]], []);
    }

    const combs = [];
    let tail_combs = [];

    for (let i = 0; i <= set.length - k + 1; i++) {
        tail_combs = k_combinations(set.slice(i + 1), k - 1);
        for (let j = 0; j < tail_combs.length; j++) {
            combs.push([set[i], ...tail_combs[j]]);
        }
    }

    return combs;
};

export const absoluteAngleDifference = (a, b) => {
    return 180 - Math.abs(Math.abs(a - b) - 180);
};

//https://stackoverflow.com/questions/45309447/calculating-median-javascript
// const median = (arr: number[]): number | undefined => {
//     if (!arr.length) return undefined;
//     const s = [...arr].sort((a, b) => a - b);
//     const mid = Math.floor(s.length / 2);
//     return s.length % 2 === 0 ? ((s[mid - 1] + s[mid]) / 2) : s[mid];
// };
export function median(numbers) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return sorted[middle];
}

export function average(numbers) {
    return numbers.reduce((p, c) => p + c, 0) / numbers.length;
}


export const euclideanDist = (a, b) => {
    let _a = a;
    let _b = b;

    if (a.hasOwnProperty("x") &&
        a.hasOwnProperty("y")) {
        _a = [a.x, a.y];
    }
    if (b.hasOwnProperty("x") &&
        b.hasOwnProperty("y")) {
        _b = [b.x, b.y];
    }
    return Math.hypot(_b[0] - _a[0], _b[1] - _a[1]);
}

export const combinations = (set) => {
    return set.reduce(
        (acc, cur, idx) => [...acc, ...k_combinations(set, idx + 1)],
        [[]]
    );
};

//https://stackoverflow.com/questions/4025893/how-to-check-identical-array-in-most-efficient-way
export const arraysEqual = function (arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = arr1.length; i--;) {
        if (arr1[i] !== arr2[i]) return false;
    }

    return true;
};

export const countDifferentCluster = function (cl1, cl2, binCount) {
    let result = '';
    for (let i = 0; i < binCount; i++) {
        if (cl1[i] !== cl2[i]) {
            result += 1;
        } else {
            result += 0;
        }
    }
    return result;
};

export const getDifferentCluster = function (cl1, cl2, binCount) {
    const result = [];
    for (let i = 0; i < binCount; i++) {
        if (cl1[i] !== cl2[i]) {
            result.push(i);
        }
    }
    return result;
};

//// Group by Functions

export const groupBy = function (xs, key) {
    return xs.reduce((rv, x) => {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, new Array());
};

export const groupByMultipleKeys = function (xs, key1, key2) {
    return xs.reduce((rv, x) => {
        (rv[x[key1]] = rv[x[key1]] || []).push(x);
        return rv;
    }, new Array());
};

const groupBySingleton = function (xs, key) {
    return xs.reduce((rv, x) => {
        if (x[key].length > 0) {
            for (const el of x[key]) {
                (rv[el] = rv[el] || []).push(x);
            }
        }
        return rv;
    }, new Array());
};

export const groupLinksBySet = function (nodes) {
    const grouped = groupBy(
        nodes.map(d => d),
        'changedBit'
    );
    return grouped.map((d) => {
        return d.sort((a, b) => {
            if (a.linkIndex > b.linkIndex) {
                return 1;
            }
            if (a.linkIndex < b.linkIndex) {
                return -1;
            }
            return 0;
        });
        return d;
    });
};

export const groupBySet = function (nodes) {
    return groupBySingleton(
        nodes.map(d => d),
        'labels'
    );
};

export const nodesByColumn = function (nodes) {
    return groupBy(
        nodes.filter((d) => d.type === 'element' && !d.isRemoved),
        'xID'
    ); //&& d.rank != 0 && d.rank != binCount
};

export const nodesByRow = function (nodes) {
    return groupBy(
        nodes.filter((d) => d.type === 'element' && !d.isRemoved),
        'yID'
    );
};

export const nodesByRankNonEmpty = function (nodes) {
    const grouped = groupBy(
        nodes.filter((d) => d.type === 'element' && !d.isRemoved && d.count > 0),
        'rank'
    );
    return grouped.map((d) => {
        return d.sort((a, b) => {
            if (a.xID > b.xID) {
                return 1;
            }
            if (a.xID < b.xID) {
                return -1;
            }
            return 0;
        });
    }).filter(d => d);
};

export const nodesByRank = function (nodes) {
    const grouped = [...groupBy(
        nodes.filter((d) => d.type === 'element' && !d.isRemoved),
        'rank'
    )].filter(d => d);
    return grouped.map((d) => {
        return d.sort((a, b) => {
            if (a.xID > b.xID) {
                return 1;
            }
            if (a.xID < b.xID) {
                return -1;
            }
            return 0;
        });
    });
};

export const sortByYID = function (tempNodes) {
    if (
        tempNodes === undefined ||
        tempNodes.length === 1 ||
        tempNodes.length === 0
    ) {
        return tempNodes;
    }
    return tempNodes.sort((a, b) => {
        if (a.yID > b.yID) {
            return 1;
        }
        if (a.yID < b.yID) {
            return -1;
        }
        return 0;
    });
};

export const calculateMidPoint = function (point1, point2) {
    return ((point1 + point2) / 2);
};

export const getCircularPosition = function (radius, angle, circleCenter) {

    // evenly spaces nodes along arc
    angle = angle * (Math.PI / 180); // Convert from Degrees to Radians
    const x = circleCenter[0] + radius * Math.cos(angle);
    const y = circleCenter[1] + radius * Math.sin(angle);
    return [x, y];
};

export const getLastElementOfRank = function (nodes, rank) {
    const filtered = nodes[rank].filter(d => d.isPlaced);
    return filtered[filtered.length - 1];
};


export const sortByXidDistance = function (array, element) {
    array.sort((a, b) => {
        if (Math.abs(element.xID - a.xID) > Math.abs(element.xID - b.xID)) {
            return 1;
        } else if (Math.abs(element.xID - a.xID) === Math.abs(element.xID - b.xID)) {
            if (a.xID > b.xID) {
                return 1;
            } else {
                return -1;
            }
        } else {
            return -1;
        }
    });
    return array;
};


/////////////////////////////////////////////////
/// Functions for creating the symmetric link ///
/////////////////////////////////////////////////

function firstUnmatched1(v) {
    /***********************************************************

     Returns an integer with the position of the first
     unmatched 1. If none is found, the function
     returns -1.

     @v is the input vector to be searched for unmatched 1s

     ***********************************************************/

    let counter = 0;
    for (let i = 0; i < v.length; i++) {
        if (v[i] === 1) {
            counter++;
            if (counter > 0) return i;
        } else {
            counter--;
        }
    }
    return -1; // no unmatched @which
}

function firstUnmatched0(v) {
    /***********************************************************

     Returns an integer with the position of the first
     unmatched 0. If none is found, the function
     returns -1.

     @v is the input vector to be searched for unmatched 0s

     ***********************************************************/

    let counter = 0;
    let ismatched = false;
    for (let i = 0; i < v.length - 1; i++) {
        counter = 0;
        if (v[i] === 0) {
            ismatched = false;
            for (let j = i + 1; j < v.length; j++) {
                if (v[j] === 0) {
                    counter++;
                } else {
                    counter--;
                }
                if (counter < 0) ismatched = true;
            }
            if (!ismatched) return i;
        }
    }
    if (v[v.length - 1] === 0) return v.length - 1;
    return -1; // no unmatched @which
}

function getBranches(v) {
    /***********************************************************

     Returns a vector containing all of the branches derived
     from the input vector. These are obtained by changing to
     1 each 0 to the right of the last 1 if the resulting
     vector has no unmatched 1s. If there are no branches,
     the return vector is empty.

     @v input binary vector

     ***********************************************************/

    let last1 = 0;
    let tempV;
    const result = [];
    for (let i = 0; i < v.length; i++) {
        // Get last 1
        if (v[i] === 1) last1 = i;
    }
    for (let i = last1 + 1; i < v.length; i++) {
        tempV = [...v];
        tempV[i] = 1;
        if (firstUnmatched1(tempV) === -1) {
            result.push(tempV);
        }
    }
    return result;
}

function fillRow(v, column) {
    const result = [...v];
    let position = firstUnmatched0(result);
    const row = new Array(v);
    while (position !== -1) {
        result[position] = 1;
        row.push([...result]);
        position = firstUnmatched0(result);
    }
    column.push([...row]);
    //row = [];
}

function fillColumn(c, firstTime, column) {
    let tempc = [];
    // let m = 1;
    for (let i = 0; i < c.length; i++) {
        fillRow(c[i], column);
        tempc = getBranches(c[i]);
        fillColumn(tempc, false, column);
        //Added with all parents
        if (firstTime) {
            // m = m + i;
            // while(column[m+1] != undefined && !hasTwinChain(column[m+1])){
            //     reorderStaticChains(m)
            // }
            //
            // m = column.length;
        }
    }
    return column;
}


export const createChains = function (setIntersection) {
    const column = [];

    const currentV = setIntersection[0];
    fillRow(currentV, column);
    const currentC = getBranches(currentV);
    return fillColumn(currentC, true, column);
};

////////////////////////////////////get
/// Functions for DAG ///
////////////////////////////////////
export const getDagElement = function (tree, vertex) {
    let elementUp = -1;
    tree.eachBefore((d) => {
        //get current node
        if (d.data.id === vertex.id) {
            //get current parent
            elementUp = d;
        }
    });
    return elementUp;
};

export const getDagElementReorder = function (tree, vertex) {
    let elementUp = -1;
    tree.eachBefore((d) => {
        //get current node
        if (d.data.scdID === vertex.id) {
            //get current parent
            elementUp = d;
        }
    });
    return elementUp;
};

export const linkDataP = function (source, target) {
    return {source: source.id, target: target.id, id: 'p'};
    // }rankID
};

export const linkDataPQ = function (source, target) {
    // if(source.linkedNeighbourBottomCurrentList.has(target.id)){
    return {source: source.rankID, target: target.rankID, id: 'p'};
    // }
};

export const createHierarchyCurrent = function (nodes) {
    const stratData = [];
    for (const node of nodes.filter(
        (d) => d.type === 'element' && !d.isRemoved
    )) {
        let newData = {};
        newData = node;
        // newData.parentIds = Array.from(node.linkedNeighbourTopCurrentList);
        // newData.childIds = Array.from(node.linkedNeighbourBottomCurrentList);
        stratData.push(newData);
    }
    return stratData;
};

// export const createHierarchy = function (nodes) {
//     const stratData = [];
//     for (const node of nodes.filter(
//         (d) => d.type === 'element' && !d.isRemoved
//     )) {
//         let newData = {};
//         newData = node;
//         newData.parentIds = Array.from(node.linkedNeighbourTopList);
//         newData.childIds = Array.from(node.linkedNeighbourBottomList);
//         stratData.push(newData);
//     }
//     return stratData;
// };

//////////////////////////
/// Helper Graph
/////////////////////////

// export const color = d3.scaleOrdinal(d3.schemeCategory10);//schemeCategory10 //schemeSet3
// export const color = d3.scaleOrdinal()
// 	.domain([0, 1, 2])
// 	.range(["#4DD145", "#FFC000", "#FF5453"]);

export const circleFill = function (d) {
    if (d.isActive) {
        return 'white';
    } else {
        return 'transparent';
    }
};

export const circleStrokeWidth = function (d) {
    if (d.count === 0) {
        return '2';
    } else {
        return '2';
    }
};

export const linkStroke = function (d) {
    if (d.isActive) {
        return color(d.changedBit);
    } else {
        return 'none';
    }
};

export const linkStrokeWidth = function (d) {
    if (d.currentLink) {
        return 5;
    } else {
        return 1;
    }
};

export function vec2(x, y) {
    this.length = function () {
        return Math.sqrt((this.x * this.x) + (this.y * this.y));
    }
    this.normalize = function () {
        let scale = this.length();
        this.x /= scale;
        this.y /= scale;
    }
    this.x = x;
    this.y = y;
}

export function getAngle(vector, offsetW, offsetH) {
    vector.normalize()
    const angle = Math.atan2(vector.y, vector.x);
    // let angle = Math.atan2(vector.y, vector.x);   //radians
    // let angleDir = atan2(vector2.y, vector2.x) - atan2(v2.y, v2.x);
    // you need to devide by PI, and MULTIPLY by 180:

    // // Handle wrap around
    // if (angle > Math.PI/2) {
    // 	angle -= 2*Math.PI}
    // else if (angle < -(Math.PI/2)) {
    // 	angle += 2*Math.PI};

    const degrees = 180 * angle / Math.PI;  //degrees
    return degrees;
    // return (360+Math.round(degrees))%360; //round number, avoid decimal fragments
}

export function getavgAngle(a1, a2) {
    let a = a1;
    const b = a2;
    let atemp = a;
    let btemp = b;
    if (a2 < a1) {
        btemp = btemp + 360
    } else {

    }
    if (a < b) {
        //simply divide
        // if (Math.abs(a - b) > 180) {
        //     atemp = a + 360;
        // }
    }
    // else {
    //     if (Math.abs(a - b) > 180) {
    //         atemp = a - 360;
    //     }
    // }
    let angle2 = (atemp + btemp) / 2;
    // if (Math.abs(a - b) < 180 && a > 180 && b < 90) {
    //     angle2 = atemp + ((360-atemp + btemp)/2) ;
    // }
    if (angle2 < 0) angle2 = angle2 + 360;
    if (angle2 >= 360) angle2 = angle2 - 360;
    return angle2

}

//https://gist.github.com/lengstrom/8499382
function sameSign(a, b) {
    return Math.sign(a) == Math.sign(b);
}

export function intersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    var a1, a2, b1, b2, c1, c2;
    var r1, r2, r3, r4;
    var denom, offset, num;

    // Compute a1, b1, c1, where line joining points 1 and 2
    // is "a1 x + b1 y + c1 = 0".
    a1 = y2 - y1;
    b1 = x1 - x2;
    c1 = (x2 * y1) - (x1 * y2);

    // Compute r3 and r4.
    r3 = ((a1 * x3) + (b1 * y3) + c1);
    r4 = ((a1 * x4) + (b1 * y4) + c1);

    // Check signs of r3 and r4. If both point 3 and point 4 lie on
    // same side of line 1, the line segments do not intersect.
    if ((r3 !== 0) && (r4 !== 0) && sameSign(r3, r4)) {
        return 0; //return that they do not intersect
    }

    // Compute a2, b2, c2
    a2 = y4 - y3;
    b2 = x3 - x4;
    c2 = (x4 * y3) - (x3 * y4);

    // Compute r1 and r2
    r1 = (a2 * x1) + (b2 * y1) + c2;
    r2 = (a2 * x2) + (b2 * y2) + c2;

    // Check signs of r1 and r2. If both point 1 and point 2 lie
    // on same side of second line segment, the line segments do
    // not intersect.
    if ((r1 !== 0) && (r2 !== 0) && (sameSign(r1, r2))) {
        return 0; //return that they do not intersect
    }

    //Line segments intersect: compute intersection point.
    denom = (a1 * b2) - (a2 * b1);

    //collinear
    if (Math.abs(denom) < 0.001) {

        if (x1 > x2) {
            const tmp = x1
            x1 = x2
            x2 = tmp
        }

        if (y1 > y2) {
            const tmp = y1
            y1 = y2
            y2 = tmp
        }

        //const xBetween = (x1 >= x3 && x1 <= x4 || x2 >= x3 && x2 <= x4 || x1 <= x3 && x3 >= x2);
        //const yBetween = (y1 >= y3 && y1 <= y4 || y2 >= y3 && y2 <= y4 || y1 <= y3 && y3 >= y2);
        if (x1 + 0.01 < x4 && x2 - 0.01 > x3 && y1 + 0.01 < y4 && y2 - 0.01 > y3) {
            return 1;
        }
        return 0;
    }

    // lines_intersect
    return 1; //lines intersect, return true
}

export function intersect2(
    x1, y1, x2, y2,
    x3, y3, x4, y4
) {


    // Check if none of the lines are of length 0
    if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
        return false
    }


    const denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))
    const numera = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3))
    const numerb = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3))

    // Lines are parallel
    if (Math.abs(denominator) < 0.001) {
        const isColinear = Math.abs(numera) < 0.001 && Math.abs(numerb) < 0.001;
        if (isColinear) {
            if (x1 > x2) {
                const tmp = x1
                x1 = x2
                x2 = tmp
            }

            if (y1 > y2) {
                const tmp = y1
                y1 = y2
                y2 = tmp
            }

            //const xBetween = (x1 >= x3 && x1 <= x4 || x2 >= x3 && x2 <= x4 || x1 <= x3 && x3 >= x2);
            //const yBetween = (y1 >= y3 && y1 <= y4 || y2 >= y3 && y2 <= y4 || y1 <= y3 && y3 >= y2);
            if (x1 < x4 && x2 > x3 && y1 < y4 && y2 > y3) {
                return true;
            }
            return false;
        }
        return false;
    }

    const ua = numera / denominator
    const ub = numerb / denominator

    // is the intersection along the segments
    if ((ua >= -0.01 && ua <= 1.01) && (ub >= -0.01 && ub <= 1.01)) {
        // Intersection point
        const x = x1 + ua * (x2 - x1)
        const y = y1 + ua * (y2 - y1)

        return true
    }

    return false
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1))
}

export function intersect4(s1, s2) {
    if (s1 === undefined || s2 === undefined) {
        console.log("error")
        return [false]
    }
    if (s1.ps.equalTo(s2.ps) && s1.pe.equalTo(s2.pe)) {
        //return true
    }
    let s1_short = s1 // shortenEdge(s1)
    let s2_short = s2 // shortenEdge(s2)

    if (Math.abs(s1.slope - s2.slope) > 0.01) {
        return [false, s1_short, s2_short]
    }


    if (s1_short.distanceTo(s2_short)[0] < 0.0001) {
        return [true, s1_short, s2_short]
    }


    /*
     if (s1_short.distanceTo(s2_short)[0] < 0.001 || s1.distanceTo(moveStartIn(s2))[0] < 0.001) {
         return true
     }

     if (s2.distanceTo(moveEndIn(s1))[0] < 0.001 || s2.distanceTo(moveStartIn(s1))[0] < 0.001) {
         return true
     }
 */

    return [false, s1_short, s2_short]

}

function moveEndIn(edge, amount = 1) {
    let v = edge.tangentInEnd().normalize().multiply(amount)
    return point(edge.pe.x + v.x, edge.pe.y + v.y)
}

function moveStartIn(edge, amount = 1) {
    let v = edge.tangentInStart().normalize().multiply(amount)
    return point(edge.ps.x + v.x, edge.ps.y + v.y)
}

export function shortenEdge(edge, amount = 1) {
    return segment(moveStartIn(edge, amount), moveEndIn(edge, amount))
}

export function intersect3(
    ax1, ay1, ax2, ay2,
    bx1, by1, bx2, by2
) {

    if (Math.abs(ax1 - bx1) < 0.9 && Math.abs(ay1 - by1) < 0.9 && Math.abs(ax2 - bx2) < 0.9 && Math.abs(ay2 - by2) < 0.9) {
        return true
    }

    if (Math.abs(ax2 - bx1) < 0.9 && Math.abs(ay2 - by1) < 0.9 && Math.abs(ax1 - bx2) < 0.9 && Math.abs(ay1 - by2) < 0.9) {
        return true
    }

    const lenA = distance(ax1, ay1, ax2, ay2)
    const lenB = distance(bx1, by1, bx2, by2)


    const dirA = [(ax2 - ax1) / lenA, (ay2 - ay1) / lenA]
    const dirB = [(bx2 - bx1) / lenB, (by2 - by1) / lenB]

    const angle = Math.acos((dirA[0] * dirB[0] + dirA[1] * dirB[1]))

    let t1 = Math.abs(distToSegment(ax1, ay1, bx1, by1, bx2, by2))
    let t2 = Math.abs(distToSegment(ax2, ay2, bx1, by1, bx2, by2))

    let t3 = Math.abs(distToSegment(bx1, by1, ax1, ay1, ax2, ay2))
    let t4 = Math.abs(distToSegment(bx2, by2, ax1, ay1, ax2, ay2))


    if ((Math.abs(angle) < 0.01 || Math.abs(angle - Math.PI) < 0.01)
        //&& ((t1 > 0.01 && t1 < 0.99) || (t2 > 0.01 && t2 < 0.99) || (t3 > 0.01 && t3 < 0.99) || (t4 > 0.01 && t4 < 0.99))
        && (t1 < 1 || t2 < 1 || t3 < 1 || t4 < 1)
    ) {
        console.log(angle)
        return true
    }
    return false

}


function distToSegment(px, py, lax, lay, lbx, lby) {
    let dx = lbx - lax
    let dy = lby - lay
    let l2 = dx * dx + dy * dy;

    if (l2 === 0.0)
        return Number.POSITIVE_INFINITY;

    let t = ((px - lax) * dx + (py - lay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));

    return distance(px, py, lax + t * dx, lay + t * dy);

    return t
}

function getOverlap2(e1, e2) {

    let [ax1, ay1] = e1[0]
    let [ax2, ay2] = e1[1]

    let [bx1, by1] = e2[0]
    let [bx2, by2] = e2[1]

    const lenA = distance(ax1, ay1, ax2, ay2)
    const lenB = distance(bx1, by1, bx2, by2)


    const dirA = [(ax2 - ax1) / lenA, (ay2 - ay1) / lenA]
    const dirB = [(bx2 - bx1) / lenB, (by2 - by1) / lenB]

    const angle = Math.acos((dirA[0] * dirB[0] + dirA[1] * dirB[1]))
    let t1 = Math.abs(distToSegment(ax1, ay1, bx1, by1, bx2, by2))
    let t2 = Math.abs(distToSegment(ax2, ay2, bx1, by1, bx2, by2))

    console.log(angle)

    if ((Math.abs(angle) < 0.001 || Math.abs(angle - Math.PI) < 0.001) && ((t1 > 0.01 && t1 < 0.99) || (t2 > 0.01 && t2 < 0.99))) {
        return true
    }


    return false //[[ax1, ay1], [ax2, ay2]]

}

export function colinear(
    x1, y1, x2, y2,
    x3, y3, x4, y4
) {


    // Check if none of the lines are of length 0
    if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
        return false
    }

    const denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))
    const numera = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3))
    const numerb = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3))

    // Lines are parallel
    if (Math.abs(denominator) < 0.01) {
        const isColinear = Math.abs(numera) < 0.01 && Math.abs(numerb) < 0.01;
        if (isColinear) {
            if (x1 > x2) {
                const tmp = x1
                x1 = x2
                x2 = tmp
            }

            if (y1 > y2) {
                const tmp = y1
                y1 = y2
                y2 = tmp
            }

            //const xBetween = (x1 >= x3 && x1 <= x4 || x2 >= x3 && x2 <= x4 || x1 <= x3 && x3 >= x2);
            //const yBetween = (y1 >= y3 && y1 <= y4 || y2 >= y3 && y2 <= y4 || y1 <= y3 && y3 >= y2);
            if (x1 <= x4 && x2 >= x3 && y1 <= y4 && y2 >= y3) {
                return true;
            }
            return false;
        }
        return false;
    }


    return false
}

export function
getOverlap(x1, y1, x2, y2,
           x3, y3, x4, y4) {
    let slope = (y2 - y1) / (x2 - x1);

    let isHorizontal = AlmostZero(slope);
    let isDescending = slope < 0 && !isHorizontal;
    let invertY = isDescending || isHorizontal ? -1 : 1;

    let min1 = [Math.min(x1, x2), Math.min(y1 * invertY, y2 * invertY)]
    let max1 = [Math.max(x1, x2), Math.max(y1 * invertY, y2 * invertY)]


    let min2 = [Math.min(x3, x4), Math.min(y3 * invertY, y4 * invertY)]

    let max2 = [Math.max(x3, x4), Math.max(y3 * invertY, y4 * invertY)]

    let minIntersection
    if (isDescending)
        minIntersection = [Math.max(min1[0], min2[0]), Math.min(min1[1] * invertY, min2[1] * invertY)]
    else
        minIntersection = [Math.max(min1[0], min2[0]), Math.max(min1[1] * invertY, min2[1] * invertY)]

    let maxIntersection
    if (isDescending)
        maxIntersection = [Math.min(max1[0], max2[0]), Math.max(max1[1] * invertY, max2[1] * invertY)]
    else
        maxIntersection = [Math.min(max1[0], max2[0]), Math.min(max1[1] * invertY, max2[1] * invertY)]

    let intersect = minIntersection[0] <= maxIntersection[0] &&
        (!isDescending && minIntersection[1] <= maxIntersection[1] ||
            isDescending && minIntersection[1] >= maxIntersection[1])

    if (!intersect)
        return null;

    return [minIntersection, maxIntersection]
}

function AlmostEqualTo(value1, value2) {
    return Math.abs(value1 - value2) <= 0.00001;
}

function AlmostZero(value) {
    return Math.abs(value) <= 0.00001;
}

export function roundArray(array) {
    if (array instanceof Array) {
        for (let i = 0; i < array.length; i++) {
            array[i] = roundArray(array[i])
        }
        return array;
    } else {
        return Math.round(array * 100) / 100
    }
}

//https://gist.github.com/tomericco/14b5ceac90d6eed6f9ba6cb5305f8fab
export function cosineSimilarity(vec1, vec2) {
    const dotProduct = vec1.map((val, i) => val * vec2[i]).reduce((accum, curr) => accum + curr, 0);
    const vec1Size = calcVectorSize(vec1);
    const vec2Size = calcVectorSize(vec2);
    const minx = -1
    const maxx = 1
    return (dotProduct / (vec1Size * vec2Size) - minx) / (maxx - minx);
};

export function binarySimilarity(vec1, vec2) {
    if (JSON.stringify(vec1) === JSON.stringify(vec2)) {
        return 1
    }
    return 0;
}

function dotProduct(x, y) {
    let result = 0;
    for (let i = 0, l = Math.min(x.length, y.length); i < l; i += 1) {
        result += x[i] * y[i];
    }
    return result;
}

function normalize(x) {
    let result = 0;
    for (let i = 0, l = x.length; i < l; i += 1) {
        result += x[i] ** 2;
    }
    return Math.sqrt(result);
}

//https://gist.github.com/jesus-seijas-sp/5feb3806f63a63dc7954482c232c4749
// export function cosineSimilarity(x, y) {
//     return dotProduct(x, y) / (normalize(x) * normalize(y));
// }

function calcVectorSize(vec) {
    return Math.sqrt(vec.reduce((accum, curr) => accum + Math.pow(curr, 2), 0));
};

export function nextHalfedge(e) {
    return (e % 3 === 2) ? e - 2 : e + 1;
}

export function prevHalfedge(e) {
    return (e % 3 === 0) ? e + 2 : e - 1;
}

function triangleOfEdge(e) {
    return Math.floor(e / 3);
}

function edgesOfTriangle(t) {
    return [3 * t, 3 * t + 1, 3 * t + 2];
}


function pointsOfTriangle(delaunay, t) {
    return edgesOfTriangle(t)
        .map(e => delaunay.triangles[e]);
}

function circumcenter(a, b, c) {
    const ad = a[0] ^ 2 + a[1] ^ 2;
    const bd = b[0] ^ 2 + b[1] ^ 2;
    const cd = c[0] ^ 2 + c[1] ^ 2;
    const D = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    const res = [
        1 / D * (ad * (b[1] - c[1]) + bd * (c[1] - a[1]) + cd * (a[1] - b[1])),
        1 / D * (ad * (c[0] - b[0]) + bd * (a[0] - c[0]) + cd * (b[0] - a[0])),
    ];
    return res;
}


function triangleCenter(points, delaunay, t) {
    const vertices = pointsOfTriangle(delaunay, t).map(p => points[p]);
    const res = circumcenter(vertices[0], vertices[1], vertices[2]);
    return res;
}

function saveJson(toJson) {
    let saveJson = JSON.stringify(toJson, null, 4)

    fs.writeFile('data.json', saveJson, 'utf8', (err) => {
        if (err) {
            console.log(err)
        }
    })
}

function distanceXY(pointA, pointB) {
    let dx = pointB.x - pointA.x;
    let dy = pointB.y - pointA.y;

    let dist = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));

    return dist;
}

//https://github.com/ai-on-browser/ai-on-browser.github.io/blob/main/lib/model/cumulative_sum.js
//      this._x = datas
// 		this._anom = Array(this._x.length).fill(false)
export function cumSum(data, anom) {
    let i = 0
    while (i < anom.length) {
        let k = i
        for (; k < anom.length && !anom[k]; k++) ;
        let s = 0
        for (let t = i; t < k; t++) {
            s += data[t][1]
        }
        const m = s / (k - i)

        let d = 0
        let max = -Infinity
        let idx = -1
        for (let t = i; t < k; t++) {
            d += m - data[t][1]
            if (max < Math.abs(d)) {
                max = Math.abs(d)
                idx = t
            }
        }
        anom[idx] = true
        i = k + 1
    }
}

// intersect the intersection point may be stored in the floats i_x and i_y.
export function get_line_intersection(p1, p2)
// p0_x,  p0_y,  p1_x,  p1_y, p2_x,  p2_y,  p3_x,  p3_y
{
    let s1_x, s1_y, s2_x, s2_y, i_x, i_y;
    s1_x = p1_x - p0_x;
    s1_y = p1_y - p0_y;
    s2_x = p3_x - p2_x;
    s2_y = p3_y - p2_y;

    let s, t;
    s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / (-s2_x * s1_y + s1_x * s2_y);
    t = (s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / (-s2_x * s1_y + s1_x * s2_y);

    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        // Collision detected
        if (i_x !== undefined) {
            i_x = p0_x + (t * s1_x)
        }
        ;
        if (i_y !== undefined) {
            i_y = p0_y + (t * s1_y);
        }
        return {'status': 1, 'intersectionPoint': [i_x, i_y]};
    }

    return {'status': 0, 'intersectionPoint': [i_x, i_y]}; // No collision
}

export function reformat(polygons) {
    let puzzleEdgeObjects = []
    let reformat = polygons.map(d => d['site'])
    puzzleEdgeObjects = createIntersectEdgesObjects(reformat)
    return puzzleEdgeObjects;
}

export function createIntersectEdgesObjects(polygons) {

    let overlaps = []
    let edgeDict = {}
    let allEdges = []
    let finalEdges = []
    for (const polygon of polygons) {
        if (polygon.intersectedgescombined) {
            for (const obj of polygon.intersectedgescombined) {
                //const edgePolygonIDs = polygon.polygon.site.intersectedgesObjects[index]
                /*
                if (edgePolygonIDs.source === edgePolygonIDs.target) {
                    continue
                }

                 */
                /*
                allEdges.push({
                    edge: edge,
                    height: polygon.originalObject.data.originalData.height,
                    adjacentPolygons: new Set([polygon]),
                })

                 */

                allEdges.push(obj)
            }
        }
    }
    let duplicateFreeEdges = removeduplicateEdges2(allEdges)
    duplicateFreeEdges = duplicateFreeEdges.sort((a, b) => a.current_edge.length - b.current_edge.length)

    /*

    for (let i = 0; i < duplicateFreeEdges.length; i++) {
        for (let j = i + 1; j < duplicateFreeEdges.length; j++) {
            const [restA, overlap, restB] = chopEdges(duplicateFreeEdges[i], duplicateFreeEdges[j])

            if (restA) {
                finalEdges.push(restA)
            }
            if (restB) {
                finalEdges.push(restB)
            }
            if (overlap) {
                finalEdges.push(overlap)
            }
            if (getOverlap2(duplicateFreeEdges[i].edge, duplicateFreeEdges[j].edge) && restA===undefined && restB===undefined && overlap===undefined) {
                finalEdges.push(duplicateFreeEdges[i], duplicateFreeEdges[j])
            }

        }
    }

     */


    //overlaps = getOverlaps(overlaps)
    return chopEdges2(duplicateFreeEdges)
    return duplicateFreeEdges


}

function removeduplicateEdges2(edges) {
    const retrunList = []

    for (let i = 0; i < edges.length; i++) {
        const edgeI = edges[i]
        let isDuplicate = false
        for (const edgeJ of retrunList) {

            if (edgeI.current_edge.equalTo(edgeJ.current_edge) || (edgeI.current_edge.ps.distanceTo(edgeJ.current_edge.ps) < 0.1 && edgeI.edge.pe.distanceTo(edgeJ.current_edge.pe) < 0.1) && Math.abs(edgeI.current_edge.slope - edgeJ.current_edge.slope) < 0.1) {
                //edgeJ.adjacentPolygons = new Set([...edgeJ.adjacentPolygons, ...edgeI.adjacentPolygons])
                isDuplicate = true
            }
        }
        if (!isDuplicate) {
            retrunList.push(edgeI)

        }
    }
    return retrunList
}

function chopEdges2(edges) {
    let returnlist = []
    // console.log(edges)

    for (const edge of edges) {
        //let adjacent = [...edge.adjacent].map(d => d.edge)
        if (edge.adjacent.size < 1) {
            continue
        }

        for (const adjacent of [...edge.adjacent]) {

            let overlap = getOverlappingsegment(edge.current_edge, adjacent.edge)
            if (overlap) {
                returnlist.push({
                    edge: overlap,
                    polygons: [edge.current_polygon, adjacent.polygon]
                })
            }


        }
    }

    returnlist = returnlist.sort((a, b) => a.edge.length - b.edge.length)
    // console.log(returnlist)

    let finalList = []

    for (const candidate of returnlist) {
        let onEdge = false
        for (const finaledge of finalList) {
            if (finaledge.edge.distanceTo(shortenEdge(candidate.edge, 0.01))[0] < 0.001 && Math.abs(finaledge.edge.slope - candidate.edge.slope) < 0.01) {
                onEdge = true
                break
            }
        }
        if (!onEdge) {
            finalList.push(candidate)
        }
    }

    //returnlist = returnlist.filter(d => d !== null)

    return finalList
}

function getOverlappingsegment(s1, s2) {
    if (s1.contains(s2.ps) && s1.contains(s2.pe)) {
        return s2
    }
    if (s2.contains(s2.ps) && s1.contains(s2.pe)) {
        return s1
    }

    if (s1.contains(s2.ps)) {
        return new Segment(s2.ps, s1.pe)
    }

    if (s1.contains(s2.pe)) {
        return new Segment(s1.ps, s2.pe)
    }

    if (s2.contains(s1.ps)) {
        return new Segment(s1.ps, s2.pe)
    }

    if (s2.contains(s1.pe)) {
        return new Segment(s2.ps, s1.pe)
    }

    return null


}
