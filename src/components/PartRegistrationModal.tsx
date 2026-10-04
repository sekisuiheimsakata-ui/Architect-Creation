
import React, { useState, useEffect, useRef } from 'react';

interface PartRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, folderPath: string) => void;
  existingFolders: string[];
  defaultName?: string;
}

export const PartRegistrationModal: React.FC<PartRegistrationModalProps> = ({
  isOpen, onClose, onConfirm, existingFolders, defaultName = ''
}) => {
  const [name, setName] = useState(defaultName);
  const [folderMode, setFolderMode] = useState<'existing' | 'new'>('existing');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setFolderMode('existing');
      setSelectedFolder('');
      setNewFolder('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    let finalFolder = '';
    if (folderMode === 'existing') {
      finalFolder = selectedFolder;
    } else {
      finalFolder = newFolder.trim();
      if (finalFolder && !finalFolder.endsWith('/')) finalFolder += '/';
    }
    
    onConfirm(name.trim(), finalFolder);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-800 mb-4">パーツの登録</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">パーツ名</label>
            <input ref={inputRef} type="text" value={name} onChange={e => setName(e.target.value)} 
                   className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                   placeholder="パーツ名" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">保存先フォルダ</label>
            <div className="space-y-2 border p-3 rounded-md max-h-48 overflow-y-auto">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" name="folder" checked={folderMode === 'existing' && selectedFolder === ''}
                       onChange={() => { setFolderMode('existing'); setSelectedFolder(''); }}
                       className="text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-600">なし (ルート)</span>
              </label>
              
              {existingFolders.map(folder => (
                <label key={folder} className="flex items-center space-x-2 cursor-pointer">
                  <input type="radio" name="folder" checked={folderMode === 'existing' && selectedFolder === folder}
                         onChange={() => { setFolderMode('existing'); setSelectedFolder(folder); }}
                         className="text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-slate-600">{folder}</span>
                </label>
              ))}

              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="radio" name="folder" checked={folderMode === 'new'}
                       onChange={() => setFolderMode('new')}
                       className="text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-600">新規フォルダ作成</span>
              </label>
            </div>
          </div>

          {folderMode === 'new' && (
            <div className="pl-6">
               <input type="text" value={newFolder} onChange={e => setNewFolder(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      placeholder="フォルダ名 (例: Furniture/Chairs)" />
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm bg-slate-100 rounded-md hover:bg-slate-200">キャンセル</button>
            <button type="submit" disabled={!name.trim() || (folderMode === 'new' && !newFolder.trim())} 
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">登録</button>
          </div>
        </form>
      </div>
    </div>
  );
};
