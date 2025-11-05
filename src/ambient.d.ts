//Constraint Type
type Constraint = {
    sourceID: string;
    sourcePos: [number, number];
    targetID: string;
    targetPos: [number, number];
    targetParent: Object;
    vecSourceTarget: [number, number];
    vecTargetSource: [number, number];
    distSourceTarget: number;
    isFulfilled: boolean;
    sim: number;
    bracket?: number;
    prevEdgeLength?: number;
};