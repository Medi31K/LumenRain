// Desktop (Tauri) integrations; everything falls back to the browser when not in the app.

export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Saves Markdown through a native "Save as" dialog (desktop) or a download (browser). */
export async function saveMarkdownFile(fileName: string, markdown: string) {
  if (isDesktop) {
    const [{ save }, { invoke }] = await Promise.all([import('@tauri-apps/plugin-dialog'), import('@tauri-apps/api/core')])
    const path = await save({ defaultPath: fileName, filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (path) await invoke('save_text', { path, contents: markdown })
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }))
  a.download = fileName
  a.click()
  URL.revokeObjectURL(a.href)
}
