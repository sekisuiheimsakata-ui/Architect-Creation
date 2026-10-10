
import JSZip from 'jszip';
import { RegisteredPart } from '../types';
import { createPartSvgString, parsePartFromSvgString } from './svg';
import { parsePartFromDxfString, isDxfContent } from './dxf';

export const exportPartsToZip = async (parts: RegisteredPart[]) => {
    try {
        const zip = new JSZip();

        parts.forEach(part => {
            // Use the part's sourcePath to create folder structure
            // Ensure path ends with slash if it exists, or empty string if root
            let folderPath = part.sourcePath || "";
            if (folderPath && !folderPath.endsWith('/')) {
                folderPath += '/';
            }

            // Clean name to be safe for filenames
            const safeName = part.name.replace(/[/\\?%*:|"<>]/g, '-');
            
            // Use SVG string with metadata instead of JSON
            const svgContent = createPartSvgString(part);
            zip.file(`${folderPath}${safeName}.svg`, svgContent);
        });

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `parts_library_${date}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Failed to export parts to ZIP:", error);
        alert("ZIPファイルの作成に失敗しました。");
    }
};

export const importPartsFromZip = async (file: File): Promise<RegisteredPart[]> => {
    try {
        const zip = await JSZip.loadAsync(file);
        const newParts: RegisteredPart[] = [];

        const filePromises: Promise<void>[] = [];

        zip.forEach((relativePath, zipEntry) => {
            const lowerName = zipEntry.name.toLowerCase();
            if (!zipEntry.dir && (lowerName.endsWith('.svg') || lowerName.endsWith('.dxf'))) {
                const promise = zipEntry.async("string").then(content => {
                    const pathParts = relativePath.split('/');
                    const entryFileName = pathParts.pop() || zipEntry.name;
                    const folderPath = pathParts.join('/');

                    let part: RegisteredPart | null = null;
                    if (lowerName.endsWith('.dxf') || isDxfContent(content)) {
                        part = parsePartFromDxfString(content, entryFileName);
                    } else {
                        part = parsePartFromSvgString(content);
                    }

                    if (part) {
                        newParts.push({
                            ...part,
                            id: `part-${Date.now()}-${Math.random()}`,
                            sourcePath: folderPath
                        });
                    } else {
                        console.warn("Skipping invalid or unreadable file in zip:", relativePath);
                    }
                });
                filePromises.push(promise);
            }
        });

        await Promise.all(filePromises);
        return newParts;

    } catch (error) {
        console.error("Failed to import parts from ZIP:", error);
        throw new Error("ZIPファイルの読み込みに失敗しました。");
    }
};
