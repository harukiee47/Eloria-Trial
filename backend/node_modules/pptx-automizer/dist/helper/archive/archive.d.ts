import { Node } from '@xmldom/xmldom';
import { ArchivedFile, ArchiveType } from '../../interfaces/iarchive';
import { XmlDocument } from '../../types/xml-types';
import { ArchiveParams, AutomizerFile, AutomizerParams } from '../../types/types';
import JSZip from 'jszip';
export default class Archive {
    filename: AutomizerFile;
    params: ArchiveParams;
    buffer: ArchivedFile[];
    options: JSZip.JSZipGeneratorOptions<'nodebuffer'>;
    constructor(filename: AutomizerFile, params: ArchiveParams);
    parseXml(xmlString: string): XmlDocument;
    serializeXml(XmlDocument: XMLDocument | Node): string;
    writeBuffer(archiveType: ArchiveType): Promise<void>;
    toBuffer(relativePath: any, content: any): void;
    setOptions(params: AutomizerParams): void;
    fromBuffer(relativePath: any): ArchivedFile;
}
