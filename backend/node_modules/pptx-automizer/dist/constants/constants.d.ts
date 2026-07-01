import { TargetByRelIdMapParam, TrackedRelation, TrackedRelationTag } from '../types/types';
export declare const TargetByRelIdMap: Record<string, TargetByRelIdMapParam>;
export declare const imagesTrack: () => TrackedRelation[];
export declare const hyperlinksTrack: () => TrackedRelation[];
export declare const contentTrack: () => TrackedRelationTag[];
