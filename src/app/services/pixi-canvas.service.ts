import { Injectable } from '@angular/core';
import * as PIXI from 'pixi.js';
import { Token } from '../model/interfaces';

@Injectable({ providedIn: 'root' })
export class PixiCanvasService {
    private app!: PIXI.Application;
    private backgroundSprite: PIXI.Sprite | null = null;
    private gridGraphics!: PIXI.Graphics;
    private tokensContainer!: PIXI.Container;
    private worldContainer!: PIXI.Container;
    private tokenSprites: Map<number, PIXI.Container> = new Map();
    private isReady = false;
    private pendingOperations: (() => void)[] = [];

    private runWhenReady(fn: () => void) {
        if (this.isReady) {
            fn();
        } else {
            this.pendingOperations.push(fn);
        }
    }

    // Estado
    private gridSize = 50;
    private gridColumns = 20;
    private gridRows = 15;
    private showGrid = true;

    // Pan
    private isPanning = false;
    private lastX = 0;
    private lastY = 0;

    // Callbacks
    onTokenMoved?: (tokenId: number, x: number, y: number) => void;
    onTokenClick?: (tokenId: number) => void;

    async init(canvas: HTMLCanvasElement, width: number, height: number) {
        this.app = new PIXI.Application();
        await this.app.init({
            canvas,
            width,
            height,
            backgroundColor: 0x1a1a2e,
            antialias: true,
            resizeTo: canvas.parentElement!
        });

        // Contenedor principal del mundo (pan/zoom)
        this.worldContainer = new PIXI.Container();
        this.app.stage.addChild(this.worldContainer);

        // Capas
        this.gridGraphics = new PIXI.Graphics();
        this.tokensContainer = new PIXI.Container();

        this.worldContainer.addChild(this.gridGraphics);
        this.worldContainer.addChild(this.tokensContainer);

        // Centrar
        this.worldContainer.x = (width - this.gridColumns * this.gridSize) / 2;
        this.worldContainer.y = (height - this.gridRows * this.gridSize) / 2;

        this.setupPanZoom();
        this.drawGrid();
        this.isReady = true;
        this.pendingOperations.forEach(fn => fn());
        this.pendingOperations = [];
    }

    private setupPanZoom() {
        const stage = this.app.stage;
        stage.eventMode = 'static';
        stage.hitArea = new PIXI.Rectangle(0, 0, 99999, 99999);

        // Zoom con rueda
        this.app.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.min(3, Math.max(0.3, this.worldContainer.scale.x * delta));

            const rect = this.app.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            this.worldContainer.x = mouseX - (mouseX - this.worldContainer.x) * (newScale / this.worldContainer.scale.x);
            this.worldContainer.y = mouseY - (mouseY - this.worldContainer.y) * (newScale / this.worldContainer.scale.y);
            this.worldContainer.scale.set(newScale);
        }, { passive: false });

        // Pan con botón central o Alt+click
        this.app.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                this.isPanning = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                e.preventDefault();
            }
        });

        this.app.canvas.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            this.worldContainer.x += e.clientX - this.lastX;
            this.worldContainer.y += e.clientY - this.lastY;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        });

        this.app.canvas.addEventListener('mouseup', () => this.isPanning = false);
        this.app.canvas.addEventListener('mouseleave', () => this.isPanning = false);
    }

    drawGrid() {
        this.gridGraphics.clear();
        if (!this.showGrid) return;

        this.gridGraphics.setStrokeStyle({ width: 1, color: 0x4b5563, alpha: 0.5 });

        for (let x = 0; x <= this.gridColumns; x++) {
            this.gridGraphics.moveTo(x * this.gridSize, 0);
            this.gridGraphics.lineTo(x * this.gridSize, this.gridRows * this.gridSize);
        }
        for (let y = 0; y <= this.gridRows; y++) {
            this.gridGraphics.moveTo(0, y * this.gridSize);
            this.gridGraphics.lineTo(this.gridColumns * this.gridSize, y * this.gridSize);
        }
        this.gridGraphics.stroke();
    }

    setBackground(imageData: string | null) {
        this.runWhenReady(() => this._setBackground(imageData));
    }

    private _setBackground(imageData: string | null) {
        if (this.backgroundSprite) {
            this.worldContainer.removeChild(this.backgroundSprite);
            this.backgroundSprite.destroy();
            this.backgroundSprite = null;
        }

        if (!imageData) return;

        const img = new Image();
        img.onload = () => {
            const texture = PIXI.Texture.from(img);
            this.backgroundSprite = new PIXI.Sprite(texture);
            this.backgroundSprite.width = this.gridColumns * this.gridSize;
            this.backgroundSprite.height = this.gridRows * this.gridSize;
            this.worldContainer.addChildAt(this.backgroundSprite, 0);
        };
        img.src = imageData;
    }

    setGridConfig(cols: number, rows: number, size: number) {
        this.runWhenReady(() => this._setGridConfig(cols, rows, size));
    }

    private _setGridConfig(cols: number, rows: number, size: number) {
        this.gridColumns = cols;
        this.gridRows = rows;
        this.gridSize = size;
        this.drawGrid();
        this.refreshBackground();
    }

    toggleGrid(show: boolean) {
        this.showGrid = show;
        this.drawGrid();
    }

    private refreshBackground() {
        if (this.backgroundSprite) {
            this.backgroundSprite.width = this.gridColumns * this.gridSize;
            this.backgroundSprite.height = this.gridRows * this.gridSize;
        }
    }

    addToken(token: Token, isGM: boolean) {
        this.runWhenReady(() => this._addToken(token, isGM));
    }

    private _addToken(token: Token, isGM: boolean) {
        if (this.tokenSprites.has(token.id)) return;

        const container = new PIXI.Container();
        container.x = token.x * this.gridSize;
        container.y = token.y * this.gridSize;
        container.eventMode = 'static';
        container.cursor = token.locked ? 'not-allowed' : 'grab';

        // Fondo del token
        const bg = new PIXI.Graphics();
        bg.roundRect(0, 0, this.gridSize, this.gridSize, 8);
        bg.fill({ color: token.image ? 0x000000 : parseInt(token.color.replace('#', '0x')) });
        container.addChild(bg);

        // Imagen si existe
        if (token.image) {
            const img = new Image();
            img.onload = () => {
                const texture = PIXI.Texture.from(img);
                const sprite = new PIXI.Sprite(texture);
                sprite.width = this.gridSize;
                sprite.height = this.gridSize;
                container.addChild(sprite);
            };
            img.src = token.image;
        } else {
            const label = new PIXI.Text({
                text: token.label || token.name || String(token.id),
                style: { fill: 0xffffff, fontSize: 14, fontWeight: 'bold' }
            });
            label.x = this.gridSize / 2 - label.width / 2;
            label.y = this.gridSize / 2 - label.height / 2;
            container.addChild(label);
        }

        // Drag
        if (!token.locked) {
            this.makeDraggable(container, token);
        }

        // Click
        container.on('pointerdown', (e) => {
            if (!e.altKey) this.onTokenClick?.(token.id);
        });

        this.tokensContainer.addChild(container);
        this.tokenSprites.set(token.id, container);
    }

    private makeDraggable(container: PIXI.Container, token: Token) {
        let dragging = false;
        let startX = 0;
        let startY = 0;

        container.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            if (e.altKey) return;
            dragging = true;
            startX = e.globalX - container.x * this.worldContainer.scale.x - this.worldContainer.x;
            startY = e.globalY - container.y * this.worldContainer.scale.y - this.worldContainer.y;
            container.cursor = 'grabbing';
            e.stopPropagation();
        });

        this.app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
            if (!dragging) return;
            const newX = (e.globalX - startX - this.worldContainer.x) / this.worldContainer.scale.x;
            const newY = (e.globalY - startY - this.worldContainer.y) / this.worldContainer.scale.y;
            container.x = newX;
            container.y = newY;
        });

        this.app.stage.on('pointerup', () => {
            if (!dragging) return;
            dragging = false;
            container.cursor = 'grab';

            // Snap a cuadrícula
            const snappedX = Math.round(container.x / this.gridSize);
            const snappedY = Math.round(container.y / this.gridSize);
            const clampedX = Math.max(0, Math.min(snappedX, this.gridColumns - 1));
            const clampedY = Math.max(0, Math.min(snappedY, this.gridRows - 1));

            container.x = clampedX * this.gridSize;
            container.y = clampedY * this.gridSize;

            token.x = clampedX;
            token.y = clampedY;

            this.onTokenMoved?.(token.id, clampedX, clampedY);
        });
    }

    removeToken(tokenId: number) {
        this.runWhenReady(() => this._removeToken(tokenId));
    }

    private _removeToken(tokenId: number) {
        const container = this.tokenSprites.get(tokenId);
        if (container) {
            this.tokensContainer.removeChild(container);
            container.destroy();
            this.tokenSprites.delete(tokenId);
        }
    }

    clearTokens() {
        this.runWhenReady(() => {
            this.tokenSprites.forEach((_, id) => this._removeToken(id));
        });
    }

    resize(width: number, height: number) {
        this.app.renderer.resize(width, height);
    }

    destroy() {
        this.app.destroy();
    }

    updateTokenPosition(tokenId: number, x: number, y: number) {
        this.runWhenReady(() => {
            const container = this.tokenSprites.get(tokenId);
            if (container) {
                container.x = x * this.gridSize;
                container.y = y * this.gridSize;
            }
        });
    }
}