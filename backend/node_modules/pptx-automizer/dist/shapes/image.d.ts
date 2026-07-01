import { Shape } from '../classes/shape';
import { XmlElement } from '../types/xml-types';
import { ImportedElement, ShapeModificationCallback, ShapeTargetType, Target } from '../types/types';
import { IImage } from '../interfaces/iimage';
import { RootPresTemplate } from '../interfaces/root-pres-template';
import IArchive from '../interfaces/iarchive';
import { ContentTypeExtension } from '../enums/content-type-map';
export declare class Image extends Shape implements IImage {
    extension: ContentTypeExtension;
    createdRelation: XmlElement;
    callbacks: ShapeModificationCallback[];
    constructor(shape: ImportedElement, targetType: ShapeTargetType);
    modifyOnAddedSlide(targetTemplate: RootPresTemplate, targetSlideNumber: number): Promise<Image>;
    modify(targetTemplate: RootPresTemplate, targetSlideNumber: number): Promise<Image>;
    append(targetTemplate: RootPresTemplate, targetSlideNumber: number): Promise<Image>;
    /**
     * For audio/video and svg, some more relations need to be handled.
     */
    processImageRelations(targetTemplate: RootPresTemplate, targetSlideNumber: number): Promise<void>;
    processRelatedMediaContent(targetTemplate: RootPresTemplate, targetSlideNumber: number, sourceMode: ImportedElement['sourceMode']): Promise<void>;
    processRelatedContent(targetTemplate: RootPresTemplate, targetSlideNumber: number, sourceMode: ImportedElement['sourceMode']): Promise<void>;
    modifyMediaRelation(targetTemplate: RootPresTemplate, targetSlideNumber: number, targetElement: XmlElement): Promise<Image>;
    applyImageCallbacks(): void;
    remove(targetTemplate: RootPresTemplate, targetSlideNumber: number): Promise<Image>;
    prepare(targetTemplate: RootPresTemplate, targetSlideNumber: number): Promise<void>;
    copyFiles(): Promise<void>;
    getTargetFileName(): string;
    appendTypes(): Promise<void>;
    /**
     * ToDo: This will always append a new relation, and never replace an
     * existing relation. At the end of creation process, unused relations will
     * remain existing in the .xml.rels file. PowerPoint will not complain, but
     * integrity checks will not be valid by this.
     */
    appendToSlideRels(): Promise<void>;
    hasSvgBlipRelation(): boolean;
    hasAudioRelation(): boolean;
    hasVideoRelation(): boolean;
    static getAllOnSlide(archive: IArchive, relsPath: string): Promise<Target[]>;
}
