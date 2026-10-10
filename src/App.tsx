

import React, { useReducer, useRef, useCallback, useMemo } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { Workspace } from './components/Workspace';
import { appReducer, initialState } from './state/appReducer';
import { ConfirmModal } from './components/ConfirmModal';
import { HelpModal } from './components/HelpModal';
import AppContext from './state/AppContext';
import { PdfOptionsModal, PaperSize, PaperOrientation, DraftingSettingsModal, PrintOptionsModal, SvgOptionsModal } from './components/PrintLayout';
import { exportPdf } from './utils/pdf';
import { directPrint } from './utils/print';
import { exportSvg } from './utils/svg';
import { generateFilename } from './utils/filenameGenerator';
import { PartRegistrationModal } from './components/PartRegistrationModal';
import { CopilotModal } from './components/CopilotModal';
import { CadImportModal } from './components/CadImportModal';
import { DxfOptionsModal } from './components/DxfOptionsModal';
import { exportDxf, DxfExportOptions } from './utils/dxfExport';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const App: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract keyboard logic to a custom hook
  useKeyboardShortcuts(state, dispatch);

  // --- Handlers ---

  const handleConfirmNewProject = useCallback(() => {
    dispatch({ type: 'NEW_PROJECT' });
    dispatch({ type: 'HIDE_NEW_PROJECT_CONFIRM' });
  }, []);

  const handleCancelNewProject = useCallback(() => {
    dispatch({ type: 'HIDE_NEW_PROJECT_CONFIRM' });
  }, []);

  const handleConfirmClearUnits = useCallback(() => {
    dispatch({ type: 'CLEAR_UNITS' });
    dispatch({ type: 'HIDE_CLEAR_UNITS_CONFIRM' });
  }, []);

  const handleConfirmClearDrawing = useCallback(() => {
    dispatch({ type: 'CLEAR_DRAWING' });
    dispatch({ type: 'HIDE_CLEAR_DRAWING_CONFIRM' });
  }, []);

  const handleCancelClearDrawing = useCallback(() => {
    dispatch({ type: 'HIDE_CLEAR_DRAWING_CONFIRM' });
  }, []);

  const toggleControlPanel = useCallback(() => {
    dispatch({ type: 'TOGGLE_CONTROL_PANEL' });
  }, []);

  const handleExportPdf = useCallback(async (options: { size: PaperSize; orientation: PaperOrientation; includedLayers: number[] }) => {
    await exportPdf(state, options);
    dispatch({ type: 'HIDE_PDF_OPTIONS' });
  }, [state]);

  const handleExportSvg = useCallback(async (options: { size: PaperSize; orientation: PaperOrientation; includedLayers: number[] }) => {
      await exportSvg(state, options);
      dispatch({ type: 'HIDE_SVG_OPTIONS' });
  }, [state]);

  const handleExportDxf = useCallback(async (options: DxfExportOptions) => {
      await exportDxf(state, options);
      dispatch({ type: 'HIDE_DXF_OPTIONS' });
  }, [state]);
  
  const handlePrint = useCallback(async (options: { size: PaperSize; orientation: PaperOrientation; includedLayers: number[] }) => {
    await directPrint(state, options);
    dispatch({ type: 'HIDE_PRINT_OPTIONS' });
  }, [state]);

  const handleSetDraftingSettings = useCallback((options: { size: PaperSize; orientation: PaperOrientation }) => {
    dispatch({ type: 'SET_DRAFTING_SETTINGS', payload: options });
  }, []);

  const handleSave = useCallback(() => {
    const { present, firstFloorDeduction, stairDeductions, drawingLayers, registeredParts, controlPanelRect, propertyWindowRect, draftingSettings } = state;
    const dataToSave = {
        grid: present,
        firstFloorDeduction,
        stairDeductions,
        drawingLayers,
        registeredParts,
        controlPanelRect,
        propertyWindowRect,
        draftingSettings
    };
    const jsonString = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateFilename(state, 'json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state]);

  const handleLoad = useCallback(() => {
      fileInputRef.current?.click();
  }, []);
  
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const text = e.target?.result;
              if (typeof text !== 'string') throw new Error("File content is not a string.");
              
              const loadedData = JSON.parse(text);

              if (loadedData && Array.isArray(loadedData.grid)) {
                  dispatch({ 
                      type: 'LOAD_STATE', 
                      payload: {
                          present: loadedData.grid,
                          firstFloorDeduction: loadedData.firstFloorDeduction || null,
                          stairDeductions: loadedData.stairDeductions || {},
                          drawingLayers: loadedData.drawingLayers,
                          registeredParts: loadedData.registeredParts,
                          controlPanelRect: loadedData.controlPanelRect,
                          propertyWindowRect: loadedData.propertyWindowRect,
                          draftingSettings: loadedData.draftingSettings
                      }
                  });
                  // Switch mode to drafting after successful load
                  dispatch({ type: 'SET_MODE', payload: 'drafting' });
              } else {
                  throw new Error("Invalid file format.");
              }
          } catch (error) {
              console.error("Failed to load file:", error);
              alert("ファイルの読み込みに失敗しました。ファイル形式が正しくありません。");
          }
      };
      reader.readAsText(file);
      event.target.value = ''; 
  }, []);

  const existingFolders = useMemo(() => {
    const folders = new Set<string>();
    state.registeredParts.forEach(part => {
      if (part.sourcePath) folders.add(part.sourcePath);
    });
    return Array.from(folders).sort();
  }, [state.registeredParts]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="relative h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
        
        {/* Main Layout: Workspace first, ControlPanel overlay on top */}
        <Workspace onOpenControlPanel={toggleControlPanel} />
        <ControlPanel
            isOpen={state.isControlPanelOpen}
            onClose={toggleControlPanel}
            onSave={handleSave}
            onLoad={handleLoad}
        />
        
        {/* --- Modals Section --- */}
        <ConfirmModal
          isOpen={state.isNewProjectConfirmVisible}
          onClose={handleCancelNewProject}
          onConfirm={handleConfirmNewProject}
          title="新規作成"
        >
          <p className="text-sm text-slate-500">
            現在のすべてのデータ（ユニット配置、製図データ、設定）が削除され、初期状態に戻ります。<br/>
            この操作は元に戻せません。
          </p>
        </ConfirmModal>

        <ConfirmModal
          isOpen={state.isClearUnitsConfirmVisible}
          onClose={() => dispatch({ type: 'HIDE_CLEAR_UNITS_CONFIRM' })}
          onConfirm={handleConfirmClearUnits}
          title="ユニットクリア"
        >
          <p className="text-sm text-slate-500">
            配置されたすべてのユニットが削除されます。<br/>製図データは保持されます。
          </p>
        </ConfirmModal>

        <ConfirmModal
          isOpen={state.isClearDrawingConfirmVisible}
          onClose={handleCancelClearDrawing}
          onConfirm={handleConfirmClearDrawing}
          title="製図クリア"
        >
          <p className="text-sm text-slate-500">
            すべてのレイヤーの描画線が削除されます。<br/>ユニット配置は保持されます。
          </p>
        </ConfirmModal>
        
        <PartRegistrationModal
            isOpen={state.partRegistrationStep === 'naming'}
            existingFolders={existingFolders}
            defaultName={`パーツ ${state.registeredParts.length + 1}`}
            onClose={() => dispatch({ type: 'CANCEL_PART_REGISTRATION' })}
            onConfirm={(name, folderPath) => dispatch({ type: 'COMPLETE_PART_REGISTRATION', payload: { name, folderPath } })}
        />

        <HelpModal isOpen={state.isHelpVisible} onClose={() => dispatch({ type: 'HIDE_HELP' })} />
        <PdfOptionsModal isOpen={state.isPdfOptionsVisible} onClose={() => dispatch({ type: 'HIDE_PDF_OPTIONS' })} onConfirm={handleExportPdf} drawingLayers={state.drawingLayers} />
        <PrintOptionsModal isOpen={state.isPrintOptionsVisible} onClose={() => dispatch({ type: 'HIDE_PRINT_OPTIONS' })} onConfirm={handlePrint} drawingLayers={state.drawingLayers} />
        <SvgOptionsModal isOpen={state.isSvgOptionsVisible} onClose={() => dispatch({ type: 'HIDE_SVG_OPTIONS' })} onConfirm={handleExportSvg} drawingLayers={state.drawingLayers} />
        <DxfOptionsModal 
            isOpen={state.isDxfOptionsVisible} 
            onClose={() => dispatch({ type: 'HIDE_DXF_OPTIONS' })} 
            onConfirm={handleExportDxf} 
            drawingLayers={state.drawingLayers} 
            currentSize={state.draftingSettings.size}
            currentOrientation={state.draftingSettings.orientation}
        />
        <CopilotModal isOpen={state.isCopilotModalVisible} onClose={() => dispatch({ type: 'HIDE_COPILOT_MODAL' })} state={state} />
        <DraftingSettingsModal isOpen={state.isDraftingSettingsVisible} onClose={() => dispatch({ type: 'HIDE_DRAFTING_SETTINGS' })} onConfirm={handleSetDraftingSettings} currentSettings={state.draftingSettings} />
        <CadImportModal isOpen={state.isCadImportModalVisible} onClose={() => dispatch({ type: 'HIDE_CAD_IMPORT_MODAL' })} />
        
        {/* Hidden File Input */}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" aria-hidden="true" />
      </div>
    </AppContext.Provider>
  );
};

export default App;