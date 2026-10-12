

import React from 'react';
import {
  CloseIcon, PanZoomIcon, UndoIcon, HelpSaveIcon, ModeIcon, PlaceIcon,
  DeleteIcon, CalculatorIcon, LayerIcon, KbdIcon, SelectIcon,
  RegisterPartIcon, TextIcon,
} from './Icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpItem: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode }> = ({ title, children, icon }) => (
  <div className="flex items-start space-x-4">
    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 rounded-lg mt-1">
      {icon}
    </div>
    <div>
      <h4 className="font-semibold text-slate-800">{title}</h4>
      <div className="text-sm text-slate-600 space-y-2">{children}</div>
    </div>
  </div>
);

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      aria-labelledby="help-modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl m-4 w-full max-w-2xl transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-200">
            <h3 id="help-modal-title" className="text-lg font-bold text-slate-800">
                ヘルプ
            </h3>
            <button
                onClick={onClose}
                className="p-2 -m-2 text-slate-500 hover:text-slate-800 rounded-full transition-colors"
                aria-label="閉じる"
            >
                <CloseIcon className="h-6 w-6" />
            </button>
        </header>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
            <HelpItem title="基本操作（全モード共通）" icon={<PanZoomIcon />}>
              <p><strong>画面の移動:</strong> マウスホイール（上下移動）、<kbd>Shift</kbd>+ホイール（左右移動）で表示エリアをスクロールできます。</p>
              <p><strong>拡大・縮小:</strong> <kbd>Ctrl</kbd> (Mac: <kbd>Cmd</kbd>) + マウスホイール、またはメニューパネルの「＋」「－」ボタンで拡大・縮小できます。</p>
            </HelpItem>
            <HelpItem title="元に戻す・やり直す" icon={<UndoIcon />}>
              <p>メニューパネルの矢印ボタンで、直前の操作を取り消したり（元に戻す）、取り消した操作を再度実行したり（やり直す）できます。</p>
              <p>ショートカットキー (Win: <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>, Mac: <kbd>Cmd</kbd>+<kbd>Z</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>) も利用できます。</p>
            </HelpItem>
             <HelpItem title="データ操作" icon={<HelpSaveIcon />}>
              <p><strong>保存:</strong> 現在の配置や描画内容をJSONファイルとしてPCに保存します。</p>
              <p><strong>読込:</strong> 保存したJSONファイルを読み込んで、状態を復元します。</p>
            </HelpItem>
             <HelpItem title="モード切替" icon={<ModeIcon />}>
              <p>メニューパネルのタブで「ユニット配置モード」と「製図モード」を切り替えることができます。</p>
            </HelpItem>
            
            <hr className="border-slate-200 my-4" />
            <h3 className="text-base font-bold text-slate-700">ユニット配置モード</h3>

            <HelpItem title="ユニットの配置" icon={<PlaceIcon />}>
              <p>メニューパネルからユニットを選択し、グリッド上のセルをクリックすると、その位置で最も低い階層に配置されます。</p>
              <p>2階以上にユニットを置くには、真下にメインユニットが配置されている必要があります（αユニットの上には配置できません）。</p>
            </HelpItem>

            <HelpItem title="ユニットの削除" icon={<DeleteIcon />}>
              <p>削除したいユニットをダブルクリックします。複数階に積まれている場合は、一番上の階のユニットから削除されます。</p>
            </HelpItem>

            <HelpItem title="面積計算とPDF出力" icon={<CalculatorIcon />}>
              <p><strong>面積計算:</strong> ユニットを配置すると、施工面積が自動計算されます。各階の詳細から減算オプションを選択できます。</p>
              <p><strong>PDF出力:</strong> 現在の配置図をPDFファイルとして出力します。用紙サイズや向き、含める描画レイヤーを選択できます。</p>
            </HelpItem>
            
            <hr className="border-slate-200 my-4" />
            <h3 className="text-base font-bold text-slate-700">製図モード</h3>
            
            <HelpItem title="図形の選択と操作" icon={<SelectIcon />}>
              <p><strong>選択ツール:</strong> メニューパネルのツールバーから矢印アイコンの「選択」ツールを選びます。</p>
              <p><strong>選択:</strong> 図形をクリックして選択します。選択された図形は青色でハイライトされます。<kbd>Shift</kbd>キーを押しながらクリックすると、複数の図形を選択・選択解除できます。何もない場所をクリックすると、すべての選択が解除されます。</p>
              <p><strong>移動:</strong> 選択した図形をドラッグして移動します。移動中は半透明のゴーストが表示されます。</p>
              <p><strong>コピー:</strong> <kbd>Alt</kbd> (Mac: <kbd>Option</kbd>) キーを押しながらドラッグすると、図形をコピーできます。</p>
              <p><strong>自由移動:</strong> 移動やコピーの操作中に<kbd>Shift</kbd>キーを長押しすると、一時的にすべての吸着（スナップ）が無効になり、自由に配置できます。</p>
              <div><strong>変形操作 (選択・移動中共通):</strong>
                  <ul className="list-disc list-inside pl-2 space-y-1 text-sm bg-slate-50 p-2 rounded border border-slate-200 mt-1">
                      <li><strong>回転:</strong> <kbd>R</kbd> (90度), <kbd>Shift</kbd>+<kbd>R</kbd> (-90度)</li>
                      <li><strong>反転:</strong> <kbd>H</kbd> (水平/左右), <kbd>V</kbd> (垂直/上下)</li>
                      <li><strong>拡大/縮小:</strong> <kbd>B</kbd> (拡大), <kbd>G</kbd> (縮小)</li>
                  </ul>
              </div>
              <p><strong>基準点切替:</strong> 移動またはコピー中に<kbd>Tab</kbd>キーを押すと、吸着の基準となる点（選択図形の頂点や交点）を順番に切り替えられます。</p>
              <p><strong>削除:</strong> 図形を選択した状態で<kbd>Delete</kbd>または<kbd>Backspace</kbd>キーを押すと削除できます。</p>
            </HelpItem>

            <HelpItem title="文字入力と図面情報（面積データ）の編集" icon={<TextIcon className="w-5 h-5" />}>
              <p><strong>文字ツール (T):</strong> ツールバーの「文字 (T)」アイコンを選択、またはキーボードの <kbd>T</kbd> キーを押します。キャンバスをクリックすると、設定した文字（または入力ダイアログ）で文字を配置できます。フォントサイズやフォント種別（ゴシック体・明朝体・等幅・メイリオ等）、カラーを自由に指定できます。</p>
              <p><strong>図面情報・面積データの編集:</strong> 図面右下の面積・縮尺データ（例: <code>1F:45.00㎡ 2F:45.00㎡ Total:90.00㎡ Scale:1/100</code>）は、編集可能な図面データとして配置されています。「選択」ツールでクリックすると、プロパティ画面で文字内容や縮尺、工事名、設計日などを直接編集できます。ダブルクリックでも編集ダイアログが開きます。「最新値に同期」ボタンを押すと、いつでも現在のユニット配置から計算した面積値に再同期できます。</p>
            </HelpItem>

            <HelpItem title="パーツの登録と配置" icon={<RegisterPartIcon className="w-6 h-6" />}>
              <div><strong>登録:</strong>
                <ol className="list-decimal list-inside pl-2 space-y-1">
                    <li>登録したい図形を「選択」ツールで選びます。</li>
                    <li>メニューパネルに表示される「パーツ登録」ボタンを押します。</li>
                    <li>キャンバスに表示される指示に従い、配置の基準となる点をクリックします。</li>
                    <li>表示されるダイアログにパーツ名を入力して登録完了です。</li>
                </ol>
              </div>
              <div><strong>配置:</strong>
                <ol className="list-decimal list-inside pl-2 space-y-1">
                    <li>メニューパネルの「パーツ」セクションを開き、配置したいパーツをクリックします。</li>
                    <li>カーソルに追従するプレビューを見ながら、配置したい場所でクリックします。</li>
                    <li>続けて複数配置できます。配置モードを終了するには<kbd>Escape</kbd>キーを押します。</li>
                </ol>
              </div>
              <div className="mt-2"><strong>配置中の操作 (ショートカット):</strong>
                  <ul className="list-disc list-inside pl-2 space-y-1 text-sm bg-slate-50 p-2 rounded border border-slate-200">
                      <li><strong>回転:</strong> <kbd>R</kbd> (90度), <kbd>Shift</kbd>+<kbd>R</kbd> (-90度)</li>
                      <li><strong>反転:</strong> <kbd>H</kbd> (水平/左右), <kbd>V</kbd> (垂直/上下)</li>
                      <li><strong>拡大/縮小:</strong> <kbd>B</kbd> (拡大), <kbd>G</kbd> (縮小)</li>
                  </ul>
              </div>
              <p><strong>管理:</strong> パーツ一覧の各項目にあるアイコンから、名称変更や削除ができます。</p>
            </HelpItem>

            <HelpItem title="描画とショートカット" icon={<KbdIcon />}>
              <p><strong>基本の描画:</strong> <strong>直線</strong>は2回のクリック（始点・終点）で描画します。<strong>連続線</strong>はクリックで頂点を追加していき、<kbd>Enter</kbd>キーまたは右クリックで描画を終了します。<strong>矩形</strong>は3回（始点→辺の終点→幅）、<strong>円弧</strong>は3回（中心→始点→終点）のクリックで描画します。描画中に<kbd>Shift</kbd>キーで15度単位の角度スナップ、<kbd>Space</kbd>キーで描画方向の反転や部分消しができます。</p>
              <p><strong>数値入力:</strong> 描画の各ステップでキーボードから数値を入力し<kbd>Enter</kbd>を押すと、正確な寸法（長さ、半径など）を指定できます。入力中の数値は画面に表示されます。</p>
              <p><strong>ツール切替:</strong> <kbd>Q</kbd>でツール、<kbd>A</kbd>で図形、<kbd>Z</kbd>で線の太さを順番に切り替えられます。</p>
              <p><strong>消しゴム:</strong> 線をクリックで全体を削除。<kbd>Space</kbd>キー長押しで部分消しモードになり、クリック＆ドラッグで赤い円が触れた部分の線が削除されます。</p>
              <p><strong>角度スナップ:</strong> 直線、連続線、矩形の描画中に<kbd>Shift</kbd>長押しで、角度を15度単位で固定します。</p>
              <p><strong>吸着と微調整:</strong> グリッドや既存の線・頂点に吸着します。<kbd>Shift</kbd>キーを離した状態で通常の吸着が働き、長押しすると一時的にすべての吸着（スナップ）が無効になります。同時に角度スナップ（15度単位）が有効になります。また、<kbd>I</kbd>(上) <kbd>M</kbd>(下) <kbd>J</kbd>(左) <kbd>K</kbd>(右) キーで吸着位置から点を微動させることができます。</p>
            </HelpItem>
            
            <HelpItem title="レイヤー操作" icon={<LayerIcon />}>
              <p><strong>レイヤーパネル:</strong> メニューパネルの「レイヤー」セクションをクリックすると展開します。リストの上が前面、下が背面に対応します。</p>
              <div><strong>描画レイヤー:</strong>
                <ul className="list-disc list-inside space-y-1 pl-2">
                    <li><strong>追加:</strong>「＋新規レイヤー」ボタンで新しいレイヤーを一番上に追加します。</li>
                    <li><strong>アクティブ化:</strong> レイヤー名部分をクリックすると描画対象になります。</li>
                    <li><strong>順序変更:</strong> ドラッグ＆ドロップで重なり順を自由に変更できます。</li>
                    <li><strong>名称変更:</strong> レイヤー名をダブルクリックすると編集できます。</li>
                    <li><strong>削除:</strong> ゴミ箱アイコンでレイヤーを削除します。</li>
                </ul>
              </div>
              <div><strong>システムレイヤー:</strong>
                <ul className="list-disc list-inside space-y-1 pl-2">
                    <li><strong>用紙枠、グリッド、ユニット配置</strong>の表示／非表示を目のアイコンで切り替えられます。これらは常に最下層にあります。</li>
                </ul>
              </div>
            </HelpItem>

        </div>

        <footer className="p-4 bg-slate-50 border-t border-slate-200 text-right">
             <button
                onClick={onClose}
                type="button"
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
                閉じる
            </button>
        </footer>
      </div>
    </div>
  );
};
