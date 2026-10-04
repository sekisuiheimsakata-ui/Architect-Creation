
import JSZip from 'jszip';
import { RegisteredPart } from '../types';
import { createPartSvgString, parsePartFromSvgString } from './svg';

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
            if (!zipEntry.dir && zipEntry.name.endsWith('.svg')) {
                const promise = zipEntry.async("string").then(content => {
                    const part = parsePartFromSvgString(content);
                    if (part) {
                        // Determine folder path from the zip entry path
                        // Remove the filename to get the directory path
                        const pathParts = relativePath.split('/');
                        pathParts.pop(); // remove filename
                        const folderPath = pathParts.join('/'); // Rejoin without trailing slash usually

                        // Regenerate ID to avoid collision, but keep original name/data.
                        // Override the sourcePath with the actual path found in the ZIP structure
                        newParts.push({
                            ...part,
                            id: `part-${Date.now()}-${Math.random()}`,
                            sourcePath: folderPath
                        });
                    } else {
                        console.warn("Skipping invalid or metadata-missing SVG in zip:", relativePath);
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
