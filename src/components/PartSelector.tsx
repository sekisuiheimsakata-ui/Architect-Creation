
import React, { useState, useMemo, useRef, memo, useCallback } from 'react';
import { useAppContext } from '../state/AppContext';
import { RegisteredPart } from '../types';
import { ChevronDownIcon, TrashIcon, HelpPencilIcon, SvgIcon, DragHandleIcon, UploadIcon, SaveIcon, FolderIcon, FolderOpenIcon, FolderPlusIcon } from './Icons';
import { pointsToSvgPath, getPathAsPoints } from '../utils/layoutCalculator';
import { exportPartToSvg, parsePartFromSvgString } from '../utils/svg';
import { exportPartsToZip, importPartsFromZip } from '../utils/zip';
import { InputModal } from './InputModal';
import { ConfirmModal } from './ConfirmModal';

// Helper component for small header icons
const HeaderIconButton: React.FC<{
    isActive?: boolean;
    onClick: (e: React.MouseEvent) => void;
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
}> = ({ isActive, onClick, children, title, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-6 h-6 flex items-center justify-center rounded-sm transition-colors ${
            isActive 
                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' 
                : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        title={title}
    >
        {children}
    </button>
);

const PartPreview: React.FC<{ part: RegisteredPart }> = memo(({ part }) => {
    const { paths } = part;

    const viewBox = useMemo(() => {
        if (!paths || paths.length === 0) return '0 0 24 24';

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasPoints = false;

        paths.forEach(path => {
            // Use getPathAsPoints to ensure bounding box includes handwriting deviations
            const pointGroups = getPathAsPoints(path, true, true);
            pointGroups.forEach(points => {
                points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                    hasPoints = true;
                });
            });
        });
        
        if (!hasPoints || minX === Infinity) return '0 0 24 24';

        const width = maxX - minX;
        const height = maxY - minY;
        const padding = Math.max(width, height) * 0.15 + 1;

        return `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`;
    }, [paths]);

    return (
        <svg
            className="w-10 h-10 bg-white rounded-sm border border-slate-200"
            preserveAspectRatio="xMidYMid meet"
            viewBox={viewBox}
        >
            {paths && paths.flatMap((path, pathIndex) => {
                 const pointGroups = getPathAsPoints(path, true, true);
                 return pointGroups.map((points, subIndex) => (
                    <path
                        key={`${path.id}-${pathIndex}-${subIndex}`}
                        d={pointsToSvgPath(points, false)}
                        stroke={path.color}
                        strokeWidth={(path.strokeWidth || 1) / 4}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                 ));
            })}
        </svg>
    );
});

interface FileSystemItem {
    id: string; // unique id for drag targeting
    name: string;
    type: 'file' | 'folder';
    path: string; // full path including name
    part?: RegisteredPart;
    children?: FileSystemItem[];
}

type DropIndicator = {
    targetId: string;
    position: 'top' | 'bottom' | 'inside';
};

// Memoized Components to prevent re-renders of the entire list
interface PartItemProps {
    item: FileSystemItem;
    level: number;
    isSelected: boolean;
    dropPosition: 'top' | 'bottom' | null;
    onSelect: (part: RegisteredPart) => void;
    onRename: (partId: string, name: string) => void;
    onDelete: (partId: string) => void;
    onExport: (part: RegisteredPart) => void;
    onDragStart: (e: React.DragEvent, type: 'file', id: string) => void;
    onDragOver: (e: React.DragEvent, item: FileSystemItem) => void;
    onDrop: (e: React.DragEvent, item: FileSystemItem) => void;
}

const PartItem = memo(({ item, level, isSelected, dropPosition, onSelect, onRename, onDelete, onExport, onDragStart, onDragOver, onDrop }: PartItemProps) => {
    const part = item.part!;
    const dragAllowed = useRef(false);

    return (
        <div className="relative group">
            {dropPosition === 'top' && <div className="absolute top-0 left-2 right-2 h-0.5 bg-blue-500 z-10 rounded-full pointer-events-none" />}
            <div
                onClick={() => onSelect(part)}
                draggable
                onMouseDownCapture={() => { dragAllowed.current = false; }}
                onDragStart={(e) => {
                    if (!dragAllowed.current) { e.preventDefault(); return; }
                    onDragStart(e, 'file', part.id);
                }}
                onDragOver={(e) => onDragOver(e, item)}
                onDrop={(e) => onDrop(e, item)}
                className={`flex items-center space-x-2 p-1.5 rounded-md cursor-pointer transition-colors relative ${
                    isSelected ? 'bg-blue-200 ring-2 ring-blue-400' : 'hover:bg-slate-200'
                }`}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
            >
                <div 
                    className="text-slate-400 cursor-grab active:cursor-grabbing shrink-0"
                    onMouseDown={() => { dragAllowed.current = true; }}
                >
                        <DragHandleIcon className="w-4 h-4" />
                </div>
                <div className="shrink-0">
                    <PartPreview part={part} />
                </div>
                <span className="flex-grow text-sm font-medium text-slate-800 truncate">{part.name}</span>
                
                <div className="absolute right-1 top-1.5 flex items-center bg-white/90 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onExport(part); }} onMouseDown={(e) => e.stopPropagation()} className="p-1 text-slate-500 hover:text-blue-600" title="SVG保存"><SvgIcon className="w-4 h-4 mr-0" /></button>
                    <button onClick={(e) => { e.stopPropagation(); onRename(part.id, part.name); }} onMouseDown={(e) => e.stopPropagation()} className="p-1 text-slate-500 hover:text-blue-600" title="名前変更 / 移動"><HelpPencilIcon className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(part.id); }} onMouseDown={(e) => e.stopPropagation()} className="p-1 text-slate-500 hover:text-red-600" title="削除"><TrashIcon className="w-4 h-4" /></button>
                </div>
            </div>
            {dropPosition === 'bottom' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 z-10 rounded-full pointer-events-none" />}
        </div>
    );
});

interface FolderItemProps {
    item: FileSystemItem;
    level: number;
    isExpanded: boolean;
    isDropInside: boolean;
    dropPosition: 'top' | 'bottom' | null;
    onToggle: (path: string) => void;
    onRename: (path: string, name: string) => void;
    onDelete: (path: string) => void;
    onDragStart: (e: React.DragEvent, type: 'folder', id: string) => void;
    onDragOver: (e: React.DragEvent, item: FileSystemItem) => void;
    onDrop: (e: React.DragEvent, item: FileSystemItem) => void;
    childrenNode: React.ReactNode;
}

const FolderItem = memo(({ item, level, isExpanded, isDropInside, dropPosition, onToggle, onRename, onDelete, onDragStart, onDragOver, onDrop, childrenNode }: FolderItemProps) => {
    const dragAllowed = useRef(false);
    return (
        <div className="select-none group relative">
            {dropPosition === 'top' && <div className="absolute top-0 left-2 right-2 h-0.5 bg-blue-500 z-10 rounded-full pointer-events-none" />}
            <div 
                className={`flex items-center py-1 px-2 cursor-pointer rounded transition-colors pr-16 ${isDropInside ? 'bg-blue-100 ring-2 ring-blue-300' : 'hover:bg-slate-200'}`}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={() => onToggle(item.path)}
                title="クリックで開閉"
                draggable
                onMouseDownCapture={() => { dragAllowed.current = false; }}
                onDragStart={(e) => {
                    if (!dragAllowed.current) { e.preventDefault(); return; }
                    onDragStart(e, 'folder', item.path);
                }}
                onDragOver={(e) => onDragOver(e, item)}
                onDrop={(e) => onDrop(e, item)}
            >
                <div 
                    className="text-slate-400 cursor-grab active:cursor-grabbing shrink-0 mr-1"
                    onMouseDown={(e) => { e.stopPropagation(); dragAllowed.current = true; }}
                >
                    <DragHandleIcon className="w-3 h-3" />
                </div>
                <span className="mr-1 text-slate-500">
                    {isExpanded ? <FolderOpenIcon className="w-4 h-4 text-yellow-500"/> : <FolderIcon className="w-4 h-4 text-yellow-500"/>}
                </span>
                <span className="text-sm font-medium text-slate-700 truncate">{item.name}</span>
                
                <div className="absolute right-1 top-0.5 bottom-0.5 flex items-center bg-white/90 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onRename(item.path, item.name); }} onMouseDown={(e) => e.stopPropagation()} className="p-1 text-slate-500 hover:text-blue-600" title="名前変更"><HelpPencilIcon className="w-3 h-3" /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(item.path); }} onMouseDown={(e) => e.stopPropagation()} className="p-1 text-slate-500 hover:text-red-600" title="削除"><TrashIcon className="w-3 h-3" /></button>
                </div>
            </div>
            {dropPosition === 'bottom' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 z-10 rounded-full pointer-events-none" />}
            {isExpanded && (
                <div>{childrenNode}</div>
            )}
        </div>
    );
});

export const PartSelector: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { registeredParts, selectedPartForPlacement, activeTool } = state;
    const [isOpen, setIsOpen] = useState(false); // Default closed
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
    
    // Modal States
    const [renameModal, setRenameModal] = useState<{ type: 'part'|'folder', id: string, currentName: string } | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ type: 'part'|'folder', id: string, name: string } | null>(null);
    const [newFolderModal, setNewFolderModal] = useState<{ partId: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragItem = useRef<{ type: 'file' | 'folder', id: string } | null>(null);

    // Build File Tree
    const fileTree = useMemo(() => {
        const root: FileSystemItem[] = [];
        const folderMap = new Map<string, FileSystemItem>();
        const safeParts = Array.isArray(registeredParts) ? registeredParts.filter(p => p && typeof p === 'object') : [];

        safeParts.forEach(part => {
            const pathParts = (part.sourcePath || "").split('/').filter(p => p);
            let currentLevel = root;
            let currentPath = "";

            pathParts.forEach(folderName => {
                currentPath += (currentPath ? '/' : '') + folderName;
                const folderPathWithSlash = currentPath + '/';
                let folder = folderMap.get(folderPathWithSlash);
                
                if (!folder) {
                    folder = {
                        id: folderPathWithSlash,
                        name: folderName,
                        type: 'folder',
                        path: folderPathWithSlash,
                        children: []
                    };
                    folderMap.set(folderPathWithSlash, folder);
                    currentLevel.push(folder);
                }
                if (folder.children) {
                    currentLevel = folder.children;
                }
            });

            currentLevel.push({
                id: part.id,
                name: part.name || "Unnamed Part",
                type: 'file',
                path: (part.sourcePath || "") + (part.name || "unnamed"),
                part: part
            });
        });

        return root;
    }, [registeredParts]);

    // --- Callback Handlers ---
    const toggleFolder = useCallback((path: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(path)) newSet.delete(path);
            else newSet.add(path);
            return newSet;
        });
    }, []);

    const handleSelectPart = useCallback((part: RegisteredPart) => {
        if (activeTool !== 'select') {
            dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'select' });
        }
        dispatch({ type: 'SELECT_PART_FOR_PLACEMENT', payload: selectedPartForPlacement?.id === part.id ? null : part });
    }, [dispatch, selectedPartForPlacement?.id, activeTool]);

    const handleCreateFolderClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedPartForPlacement) {
            setNewFolderModal({ partId: selectedPartForPlacement.id });
        } else {
            alert("フォルダに移動するパーツを選択してください。");
        }
    }, [selectedPartForPlacement]);

    // Drag Handlers
    const handleDragStart = useCallback((e: React.DragEvent, type: 'file' | 'folder', id: string) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
        dragItem.current = { type, id };
    }, []);

    const handleDragOverItem = useCallback((e: React.DragEvent, item: FileSystemItem) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dragItem.current) return;
        if (dragItem.current.type === 'folder' && item.id.startsWith(dragItem.current.id)) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const height = rect.height;
        
        let position: 'top' | 'bottom' | 'inside' = 'inside';

        if (item.type === 'file') {
            position = offsetY < height / 2 ? 'top' : 'bottom';
        } else {
            if (offsetY < height * 0.25) position = 'top';
            else if (offsetY > height * 0.75) position = 'bottom';
            else position = 'inside';
        }

        setDropIndicator(prev => {
            if (prev && prev.targetId === item.id && prev.position === position) return prev;
            return { targetId: item.id, position };
        });
    }, []);

    const handleDropOnItem = useCallback((e: React.DragEvent, targetItem: FileSystemItem) => {
        e.preventDefault();
        e.stopPropagation();
        setDropIndicator(null);

        if (!dragItem.current) return;
        const sourceId = dragItem.current.id;
        const sourceType = dragItem.current.type;
        
        if (sourceId === targetItem.id) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const height = rect.height;
        let position: 'top' | 'bottom' | 'inside' = 'inside';
        
        if (targetItem.type === 'file') {
             position = offsetY < height / 2 ? 'top' : 'bottom';
        } else {
             if (offsetY < height * 0.25) position = 'top';
             else if (offsetY > height * 0.75) position = 'bottom';
             else position = 'inside';
        }

        const currentParts = [...registeredParts];

        // --- FOLDER DRAG ---
        if (sourceType === 'folder') {
            const sourcePath = sourceId;
            if (targetItem.type === 'folder' && position === 'inside') {
                 if (targetItem.path.startsWith(sourcePath)) return;
                 dispatch({ type: 'MOVE_FOLDER', payload: { sourcePath: sourceId, targetPath: targetItem.id } });
                 setExpandedFolders(prev => { const s = new Set(prev); s.add(targetItem.id); return s; });
                 return;
            }
            const sourceParts = currentParts.filter(p => (p.sourcePath || "").startsWith(sourcePath));
            if (sourceParts.length === 0) return;
            const otherParts = currentParts.filter(p => !(p.sourcePath || "").startsWith(sourcePath));
            let targetIndex = -1;
            if (targetItem.type === 'file' && targetItem.part) {
                targetIndex = otherParts.findIndex(p => p.id === targetItem.part!.id);
                if (position === 'bottom') targetIndex++;
            } else if (targetItem.type === 'folder') {
                if (position === 'top') {
                    targetIndex = otherParts.findIndex(p => (p.sourcePath || "").startsWith(targetItem.path));
                } else {
                    for (let i = otherParts.length - 1; i >= 0; i--) {
                        if ((otherParts[i].sourcePath || "").startsWith(targetItem.path)) {
                            targetIndex = i + 1;
                            break;
                        }
                    }
                    if (targetIndex === -1) {
                        targetIndex = otherParts.findIndex(p => (p.sourcePath || "").startsWith(targetItem.path));
                    }
                }
            }
            if (targetIndex === -1) targetIndex = otherParts.length;
            if (targetIndex > otherParts.length) targetIndex = otherParts.length;
            otherParts.splice(targetIndex, 0, ...sourceParts);
            dispatch({ type: 'REORDER_REGISTERED_PARTS', payload: { newOrder: otherParts } });
            return;
        }

        // --- FILE DRAG ---
        if (sourceType === 'file') {
             const sourceIndex = currentParts.findIndex(p => p.id === sourceId);
             if (sourceIndex === -1) return;
             if (targetItem.type === 'folder' && position === 'inside') {
                 dispatch({ type: 'MOVE_PART_TO_FOLDER', payload: { partId: sourceId, newPath: targetItem.path } });
                 setExpandedFolders(prev => { const s = new Set(prev); s.add(targetItem.path); return s; });
                 return;
             }
             const [sourcePart] = currentParts.splice(sourceIndex, 1);
             if (targetItem.type === 'file') {
                 sourcePart.sourcePath = targetItem.part!.sourcePath;
             } else if (targetItem.type === 'folder') {
                 const parts = targetItem.path.split('/').filter(Boolean);
                 parts.pop(); 
                 const parentPath = parts.length > 0 ? parts.join('/') + '/' : '';
                 sourcePart.sourcePath = parentPath;
             }
             let targetIndex = -1;
             if (targetItem.type === 'file' && targetItem.part) {
                 targetIndex = currentParts.findIndex(p => p.id === targetItem.part!.id);
                 if (position === 'bottom') targetIndex++;
             } else if (targetItem.type === 'folder') {
                 if (position === 'top') {
                     targetIndex = currentParts.findIndex(p => (p.sourcePath || "").startsWith(targetItem.path));
                 } else {
                     let lastTargetIndex = -1;
                     for (let i = 0; i < currentParts.length; i++) {
                         if ((currentParts[i].sourcePath || "").startsWith(targetItem.path)) {
                             lastTargetIndex = i;
                         }
                     }
                     targetIndex = lastTargetIndex !== -1 ? lastTargetIndex + 1 : currentParts.length;
                 }
             }
             if (targetIndex === -1) targetIndex = currentParts.length;
             currentParts.splice(targetIndex, 0, sourcePart);
             dispatch({ type: 'REORDER_REGISTERED_PARTS', payload: { newOrder: currentParts } });
        }
    }, [registeredParts, dispatch]);

    const handleDropOnRoot = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropIndicator(null);
        if (!dragItem.current) return;
        const sourceId = dragItem.current.id;
        const sourceType = dragItem.current.type;
        if (sourceType === 'file') {
             dispatch({ type: 'MOVE_PART_TO_FOLDER', payload: { partId: sourceId, newPath: "" } });
        } else if (sourceType === 'folder') {
             dispatch({ type: 'MOVE_FOLDER', payload: { sourcePath: sourceId, targetPath: "" } });
        }
    }, [dispatch]);

    // Import/Export Handlers
    const handleImportParts = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        const newParts: RegisteredPart[] = [];
        let successCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.toLowerCase().endsWith('.zip')) {
                try {
                    const parts = await importPartsFromZip(file);
                    newParts.push(...parts);
                    successCount += parts.length;
                } catch (e) { console.error(`Failed to import zip: ${file.name}`, e); }
            } else if (file.name.toLowerCase().endsWith('.svg')) {
                try {
                    const text = await file.text();
                    const part = parsePartFromSvgString(text);
                    if (part) {
                        if (part.name === 'Imported SVG') part.name = file.name.replace(/\.svg$/i, '');
                        part.id = `part-${Date.now()}-${Math.random()}`;
                        newParts.push(part);
                        successCount++;
                    }
                } catch (e) { console.error(`Failed to import svg: ${file.name}`, e); }
            }
        }
        if (newParts.length > 0) {
            dispatch({ type: 'IMPORT_REGISTERED_PARTS', payload: { parts: newParts } });
            alert(`${successCount}個のパーツを読み込みました。`);
        } else {
            alert("有効なパーツが見つかりませんでした。");
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [dispatch]);

    const renderTreeNodes = useCallback((items: FileSystemItem[], level: number = 0) => {
        return items.map((item) => {
            if (item.type === 'folder') {
                const isDropInside = dropIndicator?.targetId === item.id && dropIndicator.position === 'inside';
                const isTop = dropIndicator?.targetId === item.id && dropIndicator.position === 'top';
                const isBottom = dropIndicator?.targetId === item.id && dropIndicator.position === 'bottom';
                return (
                    <FolderItem
                        key={item.id}
                        item={item}
                        level={level}
                        isExpanded={expandedFolders.has(item.path)}
                        isDropInside={isDropInside}
                        dropPosition={isTop ? 'top' : isBottom ? 'bottom' : null}
                        onToggle={toggleFolder}
                        onRename={(path, name) => setRenameModal({ type: 'folder', id: path, currentName: name })}
                        onDelete={(path) => setDeleteModal({ type: 'folder', id: path, name: item.name })}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOverItem}
                        onDrop={handleDropOnItem}
                        childrenNode={renderTreeNodes(item.children || [], level + 1)}
                    />
                );
            } else if (item.part) {
                const isTop = dropIndicator?.targetId === item.id && dropIndicator.position === 'top';
                const isBottom = dropIndicator?.targetId === item.id && dropIndicator.position === 'bottom';
                return (
                    <PartItem
                        key={item.id}
                        item={item}
                        level={level}
                        isSelected={selectedPartForPlacement?.id === item.part.id}
                        dropPosition={isTop ? 'top' : isBottom ? 'bottom' : null}
                        onSelect={handleSelectPart}
                        onRename={(id, name) => setRenameModal({ type: 'part', id, currentName: name })}
                        onDelete={(id) => setDeleteModal({ type: 'part', id, name: item.name })}
                        onExport={exportPartToSvg}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOverItem}
                        onDrop={handleDropOnItem}
                    />
                );
            }
            return null;
        });
    }, [expandedFolders, dropIndicator, selectedPartForPlacement, toggleFolder, handleDragStart, handleDragOverItem, handleDropOnItem, handleSelectPart]);

    const partCount = Array.isArray(registeredParts) ? registeredParts.length : 0;

    // Adjusted header layout to match DraftingToolbar style
    return (
        <div className="border-b border-slate-100 last:border-0 pb-1">
            <div
                className="flex items-center justify-between px-1 py-0.5 cursor-pointer hover:bg-slate-50 rounded-md select-none"
                onClick={() => setIsOpen(prev => !prev)}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-50'); }}
                onDragLeave={(e) => e.currentTarget.classList.remove('bg-blue-50')}
                onDrop={(e) => { e.currentTarget.classList.remove('bg-blue-50'); handleDropOnRoot(e); }}
            >
                <h3 className="text-xs font-bold text-slate-600 shrink-0">パーツ</h3>
                <div className="flex items-center space-x-0.5 justify-end flex-grow min-w-0" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center space-x-0.5 shrink-0">
                        <HeaderIconButton onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} title="読込 (ZIP/SVG)">
                            <UploadIcon className="w-4 h-4" />
                        </HeaderIconButton>
                        <input type="file" ref={fileInputRef} onChange={handleImportParts} accept=".zip,.svg" multiple className="hidden" />
                        <HeaderIconButton onClick={(e) => { e.stopPropagation(); if(partCount > 0) exportPartsToZip(registeredParts); }} disabled={partCount === 0} title="書出 (ZIP)">
                            <SaveIcon className="w-4 h-4" />
                        </HeaderIconButton>
                        <HeaderIconButton onClick={handleCreateFolderClick} disabled={!selectedPartForPlacement} title="フォルダ作成">
                            <FolderPlusIcon className="w-4 h-4" />
                        </HeaderIconButton>
                    </div>
                    <div 
                        className="pl-1 text-slate-400 flex items-center justify-center w-5 h-5 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setIsOpen(prev => !prev); }}
                    >
                        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </div>

            <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden px-1">
                    <div className="bg-slate-100 p-2 rounded-lg mt-1">
                        <div className="max-h-80 overflow-y-auto bg-white rounded border border-slate-200 min-h-[100px]">
                            {partCount === 0 ? (
                                <div 
                                    className="h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center"
                                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-50'); }}
                                    onDragLeave={(e) => { e.currentTarget.classList.remove('bg-blue-50'); }}
                                    onDrop={(e) => { e.currentTarget.classList.remove('bg-blue-50'); handleDropOnRoot(e); }}
                                >
                                    <span className="text-xs">パーツがありません</span>
                                    <span className="text-[10px] mt-1">登録するかZIP/SVGを読み込んでください</span>
                                </div>
                            ) : (
                                <div className="py-1">
                                    {renderTreeNodes(fileTree)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <InputModal
                isOpen={!!renameModal}
                title={renameModal?.type === 'folder' ? "フォルダ名の変更" : "パーツ名の変更"}
                defaultValue={renameModal?.currentName}
                placeholder={renameModal?.type === 'folder' ? "NewFolder/SubFolder" : "パーツ名 (フォルダ名/パーツ名 で移動可能)"}
                onClose={() => setRenameModal(null)}
                onConfirm={(value) => {
                    if (!renameModal) return;
                    if (renameModal.type === 'part') {
                        dispatch({ type: 'RENAME_REGISTERED_PART', payload: { partId: renameModal.id, newName: value } });
                    } else {
                        const oldPath = renameModal.id;
                        const parts = oldPath.split('/').filter(Boolean);
                        parts.pop();
                        const parentPath = parts.length > 0 ? parts.join('/') + '/' : '';
                        let finalNewPath = parentPath + value;
                        if (!finalNewPath.endsWith('/')) finalNewPath += '/';
                        dispatch({ type: 'RENAME_FOLDER', payload: { oldPath, newPath: finalNewPath } });
                    }
                    setRenameModal(null);
                }}
                confirmText="変更"
            />
            
            <InputModal
                isOpen={!!newFolderModal}
                title="フォルダを作成して移動"
                placeholder="フォルダ名 (例: Furniture/Chairs)"
                onClose={() => setNewFolderModal(null)}
                onConfirm={(folderName) => {
                    if (!newFolderModal) return;
                    let newPath = folderName.trim();
                    if (newPath && !newPath.endsWith('/')) newPath += '/';
                    dispatch({ type: 'MOVE_PART_TO_FOLDER', payload: { partId: newFolderModal.partId, newPath } });
                    if (newPath) setExpandedFolders(prev => { const s = new Set(prev); s.add(newPath); return s; });
                    setNewFolderModal(null);
                }}
                confirmText="作成して移動"
            />

            <ConfirmModal
                isOpen={!!deleteModal}
                onClose={() => setDeleteModal(null)}
                onConfirm={() => {
                    if (!deleteModal) return;
                    if (deleteModal.type === 'part') {
                        dispatch({ type: 'DELETE_REGISTERED_PART', payload: { partId: deleteModal.id } });
                    } else {
                        dispatch({ type: 'DELETE_FOLDER', payload: { path: deleteModal.id } });
                    }
                    setDeleteModal(null);
                }}
                title={deleteModal?.type === 'folder' ? "フォルダの削除" : "パーツの削除"}
            >
                <p className="text-sm text-slate-600">
                    {deleteModal?.type === 'folder' 
                        ? `フォルダ「${deleteModal.name}」と中のパーツをすべて削除しますか？` 
                        : `パーツ「${deleteModal?.name}」を削除しますか？`}
                </p>
            </ConfirmModal>
        </div>
    );
};
