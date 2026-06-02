export function createButton(
    text: string,
    top: number,
    right: number = 10,
    onClick: (btn: HTMLButtonElement) => void
): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.position = "fixed";
    btn.style.top = `${top}px`;
    btn.style.right = `${right}px`;
    btn.style.zIndex = "1001";
    btn.style.padding = "8px 16px";
    btn.style.backgroundColor = "#222";
    btn.style.color = "#fff";
    btn.style.border = "none";
    btn.style.borderRadius = "6px";
    btn.style.cursor = "pointer";
    btn.onclick = () => onClick(btn);
    document.body.appendChild(btn);
    return btn;
}

export function createFPSOverlay(): HTMLDivElement {
    const fpsOverlay = document.createElement("div");
    fpsOverlay.style.position = "fixed";
    fpsOverlay.style.top = "10px";
    fpsOverlay.style.left = "10px";
    fpsOverlay.style.background = "rgba(0,0,0,0.7)";
    fpsOverlay.style.color = "#0f0";
    fpsOverlay.style.font = "bold 16px monospace";
    fpsOverlay.style.padding = "4px 10px";
    fpsOverlay.style.zIndex = "1000";
    fpsOverlay.style.borderRadius = "6px";
    fpsOverlay.textContent = "FPS: ...";
    document.body.appendChild(fpsOverlay);
    return fpsOverlay;
}

export function createPreview(
    src: string,
    bottom: number = 10,
    right: number = 10,
    borderColor: string = "#333",
    id?: string
): HTMLImageElement {
    const preview = document.createElement('img');
    preview.src = src;
    preview.style.position = 'fixed';
    preview.style.bottom = `${bottom}px`;
    preview.style.right = `${right}px`;
    preview.style.width = '150px';
    preview.style.height = '150px';
    preview.style.zIndex = '1002';
    preview.style.border = `2px solid ${borderColor}`;
    preview.style.display = 'none';
    if (id) preview.id = id;
    document.body.appendChild(preview);
    return preview;
}