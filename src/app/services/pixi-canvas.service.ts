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
    private activeMenu: PIXI.Container | null = null;
    private tokenListeners: Map<number, { onPointerMove: Function, onPointerUp: Function }> = new Map();
    private isDraggingAny = false;
    private freeMovement = false;
    private activeHighlight: PIXI.Graphics | null = null;
    private measureLine: PIXI.Graphics | null = null;
    private measureText: PIXI.Text | null = null;
    private isMeasuring = false;
    private measureStart = { x: 0, y: 0 };

    private runWhenReady(fn: () => void) {
        if (this.isReady) {
            fn();
        } else {
            this.pendingOperations.push(fn);
        }
    }

    private gridSize = 50;
    private gridColumns = 20;
    private gridRows = 15;
    private showGrid = true;

    private isPanning = false;
    private lastX = 0;
    private lastY = 0;

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

        this.worldContainer = new PIXI.Container();
        this.app.stage.addChild(this.worldContainer);

        this.gridGraphics = new PIXI.Graphics();
        this.tokensContainer = new PIXI.Container();

        this.worldContainer.addChild(this.gridGraphics);
        this.worldContainer.addChild(this.tokensContainer);

        this.worldContainer.x = (width - this.gridColumns * this.gridSize) / 2;
        this.worldContainer.y = (height - this.gridRows * this.gridSize) / 2;

        this.setupPanZoom();

        this.app.stage.on('pointerup', () => {
            if (this.isDraggingAny) {
                this.tokenListeners.forEach(({ onPointerUp }) => {
                    (onPointerUp as Function)();
                });
                this.isDraggingAny = false;
            } else {
                this.hideTokenMenu();
            }
        });

        this.drawGrid();
        this.isReady = true;
        this.pendingOperations.forEach(fn => fn());
        this.pendingOperations = [];
    }

    private setupPanZoom() {
        const stage = this.app.stage;
        stage.eventMode = 'static';
        stage.hitArea = new PIXI.Rectangle(0, 0, 99999, 99999);

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

        this.app.canvas.addEventListener('mousemove', (e) => {
            if (this.isMeasuring) {
                this.updateMeasure(e);
                return;
            }
            if (!this.isPanning) return;
            this.worldContainer.x += e.clientX - this.lastX;
            this.worldContainer.y += e.clientY - this.lastY;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        });

        this.app.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0 && e.shiftKey) {
                this.startMeasure(e);
                return;
            }
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                this.isPanning = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                e.preventDefault();
            }
        });

        this.app.canvas.addEventListener('mouseup', (e) => {
            if (this.isMeasuring) {
                this.stopMeasure();
                return;
            }
            this.isPanning = false;
        });
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

        const bg = new PIXI.Graphics();
        bg.roundRect(0, 0, this.gridSize, this.gridSize, 8);
        bg.fill({ color: token.image ? 0x000000 : parseInt(token.color.replace('#', '0x')) });
        container.addChild(bg);

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

        // Siempre registrar drag, el flag _isLocked controla si se mueve
        (container as any)._isLocked = token.locked || false;
        this.makeDraggable(container, token);

        // Mostrar condiciones si existen
        if (token.conditions && token.conditions.length > 0) {
            this.updateTokenConditions(token.id, token.conditions);
        }

        this.tokensContainer.addChild(container);
        this.tokenSprites.set(token.id, container);

        //Barra de vida
        if (token.hp !== null && token.hp !== undefined && token.max_hp) {
            this.updateTokenHP(token.id, token.hp, token.max_hp);
        }
    }

    private makeDraggable(container: PIXI.Container, token: Token) {
        const state = { dragging: false, hasMoved: false };
        let startX = 0;
        let startY = 0;

        const onPointerDown = (e: PIXI.FederatedPointerEvent) => {
            if (e.altKey) return;
            e.stopPropagation(); // siempre parar propagación

            state.dragging = true;
            state.hasMoved = false;
            this.isDraggingAny = true;

            if ((container as any)._isLocked) return; // bloqueado: no iniciar drag pero sí click

            startX = e.globalX - container.x * this.worldContainer.scale.x - this.worldContainer.x;
            startY = e.globalY - container.y * this.worldContainer.scale.y - this.worldContainer.y;
            container.cursor = 'grabbing';
        };

        const onPointerMove = (e: PIXI.FederatedPointerEvent) => {
            if (!state.dragging) return;
            if ((container as any)._isLocked) return; // bloqueado: no mover
            state.hasMoved = true;
            const newX = (e.globalX - startX - this.worldContainer.x) / this.worldContainer.scale.x;
            const newY = (e.globalY - startY - this.worldContainer.y) / this.worldContainer.scale.y;
            container.x = newX;
            container.y = newY;
        };

        const onPointerUp = () => {
            if (!state.dragging) return;
            container.cursor = (container as any)._isLocked ? 'not-allowed' : 'grab';

            if (state.hasMoved) {
                if (this.freeMovement) {
                    // Modo libre: guardar posición en píxeles dividida por gridSize
                    const x = container.x / this.gridSize;
                    const y = container.y / this.gridSize;
                    token.x = x;
                    token.y = y;
                    this.onTokenMoved?.(token.id, x, y);
                } else {
                    // Modo cuadrícula: snap
                    const snappedX = Math.round(container.x / this.gridSize);
                    const snappedY = Math.round(container.y / this.gridSize);
                    const clampedX = Math.max(0, Math.min(snappedX, this.gridColumns - 1));
                    const clampedY = Math.max(0, Math.min(snappedY, this.gridRows - 1));
                    container.x = clampedX * this.gridSize;
                    container.y = clampedY * this.gridSize;
                    token.x = clampedX;
                    token.y = clampedY;
                    this.onTokenMoved?.(token.id, clampedX, clampedY);
                }
            } else {
                this.onTokenClick?.(token.id);
            }

            state.dragging = false;
        };

        container.on('pointerdown', onPointerDown);
        this.app.stage.on('pointermove', onPointerMove);

        this.tokenListeners.set(token.id, { onPointerMove, onPointerUp });
    }

    removeToken(tokenId: number) {
        this.runWhenReady(() => this._removeToken(tokenId));
    }

    private _removeToken(tokenId: number) {
        const listeners = this.tokenListeners.get(tokenId);
        if (listeners) {
            this.app.stage.off('pointermove', listeners.onPointerMove as any);
            this.tokenListeners.delete(tokenId);
        }
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

    getScale(): number {
        return this.worldContainer.scale.x;
    }

    getWorldPosition(): { x: number, y: number } {
        return { x: this.worldContainer.x, y: this.worldContainer.y };
    }

    showTokenMenu(token: Token, isGM: boolean, callbacks: {
        onLock: () => void,
        onDelete: () => void,
        onCondition: (conditionId: string) => void,
        onAddToInitiative?: () => void,
        onHPChange?: (delta: number) => void,
        conditions: { id: string, icon: string }[]
    }) {
        this.hideTokenMenu();

        const menu = new PIXI.Container();
        const tokenContainer = this.tokenSprites.get(token.id);
        if (!tokenContainer) return;

        const btnSize = 32;
        const gap = 4;
        const hpBtns = callbacks.onHPChange && token.max_hp ? 2 : 0;
        const extraBtns = (callbacks.onAddToInitiative ? 1 : 0) + hpBtns;
        const allBtns = isGM ? 2 + extraBtns + callbacks.conditions.length : 1 + callbacks.conditions.length;
        const menuWidth = allBtns * (btnSize + gap) - gap;

        const bg = new PIXI.Graphics();
        bg.roundRect(-4, -4, menuWidth + 8, btnSize + 8, 8);
        bg.fill({ color: 0x1e1e2e, alpha: 0.95 });
        menu.addChild(bg);

        let btnX = 0;

        if (isGM) {
            const lockBtn = this.createMenuButton(token.locked ? '🔒' : '🔓', btnX, 0, btnSize, () => {
                callbacks.onLock();
                this.hideTokenMenu();
            });
            menu.addChild(lockBtn);
            btnX += btnSize + gap;
        }

        const deleteBtn = this.createMenuButton('×', btnX, 0, btnSize, () => {
            callbacks.onDelete();
            this.hideTokenMenu();
        }, 0xef4444);
        menu.addChild(deleteBtn);
        btnX += btnSize + gap;

        if (callbacks.onAddToInitiative) {
            const initiativeBtn = this.createMenuButton('⚔️', btnX, 0, btnSize, () => {
                callbacks.onAddToInitiative!();
                this.hideTokenMenu();
            }, 0x10b981);
            menu.addChild(initiativeBtn);
            btnX += btnSize + gap;
        }

        if (callbacks.onHPChange && token.max_hp) {
            const hpMinusBtn = this.createMenuButton('-❤️', btnX, 0, btnSize, () => {
                callbacks.onHPChange!(-1);
            }, 0xef4444);
            menu.addChild(hpMinusBtn);
            btnX += btnSize + gap;

            const hpPlusBtn = this.createMenuButton('+❤️', btnX, 0, btnSize, () => {
                callbacks.onHPChange!(1);
            }, 0x10b981);
            menu.addChild(hpPlusBtn);
            btnX += btnSize + gap;
        }

        for (const cond of callbacks.conditions) {
            const active = token.conditions?.includes(cond.id);
            const condBtn = this.createMenuButton(cond.icon, btnX, 0, btnSize, () => {
                callbacks.onCondition(cond.id);
                // No cerrar el menú al cambiar condición
            }, active ? 0x3b82f6 : 0x374151);
            menu.addChild(condBtn);
            btnX += btnSize + gap;
        }

        menu.x = tokenContainer.x;
        menu.y = tokenContainer.y - btnSize - 12;
        menu.eventMode = 'static';
        this.activeMenu = menu;
        this.worldContainer.addChild(menu);
    }

    private createMenuButton(label: string, x: number, y: number, size: number, onClick: () => void, bgColor: number = 0x374151): PIXI.Container {
        const btn = new PIXI.Container();
        btn.x = x;
        btn.y = y;
        btn.eventMode = 'static';
        btn.cursor = 'pointer';

        const bg = new PIXI.Graphics();
        bg.roundRect(0, 0, size, size, 6);
        bg.fill({ color: bgColor });
        btn.addChild(bg);

        const text = new PIXI.Text({ text: label, style: { fontSize: 16, fill: 0xffffff } });
        text.x = size / 2 - text.width / 2;
        text.y = size / 2 - text.height / 2;
        btn.addChild(text);

        btn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation();
            onClick();
        });

        btn.on('pointerover', () => {
            bg.clear();
            bg.roundRect(0, 0, size, size, 6);
            const hoverColor = bgColor === 0xef4444 ? 0xdc2626 :
                bgColor === 0x10b981 ? 0x059669 : 0x3b82f6;
            bg.fill({ color: hoverColor });
        });

        btn.on('pointerout', () => {
            bg.clear();
            bg.roundRect(0, 0, size, size, 6);
            bg.fill({ color: bgColor });
        });

        btn.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation();
        });

        return btn;
    }

    hideTokenMenu() {
        if (this.activeMenu) {
            this.worldContainer.removeChild(this.activeMenu);
            this.activeMenu.destroy();
            this.activeMenu = null;
        }
    }

    updateTokenConditions(tokenId: number, conditions: string[]) {
        this.runWhenReady(() => {
            const container = this.tokenSprites.get(tokenId);
            if (!container) return;

            // Eliminar iconos de condiciones anteriores
            const existingIcons = container.getChildByLabel('conditions');
            if (existingIcons) container.removeChild(existingIcons);

            if (!conditions || conditions.length === 0) return;

            const iconsContainer = new PIXI.Container();
            iconsContainer.label = 'conditions';

            conditions.forEach((condId, i) => {
                const icon = new PIXI.Text({
                    text: this.getConditionEmoji(condId),
                    style: { fontSize: 10 }
                });
                icon.x = (i % 4) * 12 + 2;
                icon.y = this.gridSize - 14;
                iconsContainer.addChild(icon);
            });

            container.addChild(iconsContainer);
        });
    }

    private getConditionEmoji(condId: string): string {
        const map: Record<string, string> = {
            dead: '💀', unconscious: '😴', poisoned: '🤢',
            burning: '🔥', stunned: '⚡', protected: '🛡️'
        };
        return map[condId] || '';
    }

    updateTokenLocked(tokenId: number, locked: boolean) {
        this.runWhenReady(() => {
            const container = this.tokenSprites.get(tokenId);
            if (!container) return;
            container.cursor = locked ? 'not-allowed' : 'grab';
            (container as any)._isLocked = locked;
        });
    }

    setFreeMovement(free: boolean) {
        this.freeMovement = free;
    }

    highlightToken(tokenId: number) {
        // Eliminar highlight anterior
        if (this.activeHighlight) {
            this.worldContainer.removeChild(this.activeHighlight);
            this.activeHighlight.destroy();
            this.activeHighlight = null;
        }

        const container = this.tokenSprites.get(tokenId);
        if (!container) return;

        const highlight = new PIXI.Graphics();
        highlight.roundRect(-3, -3, this.gridSize + 6, this.gridSize + 6, 10);
        highlight.stroke({ width: 3, color: 0xf59e0b });
        highlight.x = container.x;
        highlight.y = container.y;

        this.activeHighlight = highlight;
        this.worldContainer.addChildAt(highlight, this.worldContainer.children.indexOf(this.tokensContainer));
    }

    clearHighlight() {
        if (this.activeHighlight) {
            this.worldContainer.removeChild(this.activeHighlight);
            this.activeHighlight.destroy();
            this.activeHighlight = null;
        }
    }

    updateTokenHP(tokenId: number, hp: number, maxHP: number) {
        this.runWhenReady(() => {
            const container = this.tokenSprites.get(tokenId);
            if (!container) return;

            const existing = container.getChildByLabel('hpbar');
            if (existing) container.removeChild(existing);

            if (!maxHP || maxHP <= 0) return;

            const barContainer = new PIXI.Container();
            barContainer.label = 'hpbar';
            barContainer.y = this.gridSize + 2;

            const barWidth = this.gridSize;
            const barHeight = 6;
            const ratio = Math.max(0, Math.min(1, hp / maxHP));

            const barBg = new PIXI.Graphics();
            barBg.roundRect(0, 0, barWidth, barHeight, 2);
            barBg.fill({ color: 0x374151 });
            barContainer.addChild(barBg);

            const barFill = new PIXI.Graphics();
            const fillColor = ratio > 0.5 ? 0x10b981 : ratio > 0.25 ? 0xf59e0b : 0xef4444;
            barFill.roundRect(0, 0, barWidth * ratio, barHeight, 2);
            barFill.fill({ color: fillColor });
            barContainer.addChild(barFill);

            const hpText = new PIXI.Text({
                text: `${hp}/${maxHP}`,
                style: { fontSize: 8, fill: 0xffffff }
            });
            hpText.x = barWidth / 2 - hpText.width / 2;
            hpText.y = -10;
            barContainer.addChild(hpText);

            container.addChild(barContainer);
        });
    }

    private startMeasure(e: MouseEvent) {
        this.isMeasuring = true;
        const rect = this.app.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.worldContainer.x) / this.worldContainer.scale.x;
        const mouseY = (e.clientY - rect.top - this.worldContainer.y) / this.worldContainer.scale.y;

        // Snap al centro de la celda más cercana
        this.measureStart = {
            x: Math.round(mouseX / this.gridSize) * this.gridSize,
            y: Math.round(mouseY / this.gridSize) * this.gridSize
        };

        this.measureLine = new PIXI.Graphics();
        this.measureText = new PIXI.Text({
            text: '',
            style: {
                fontSize: 14, fill: 0xffffff, fontWeight: 'bold',
                dropShadow: true
            }
        });

        this.worldContainer.addChild(this.measureLine);
        this.worldContainer.addChild(this.measureText);
    }

    private updateMeasure(e: MouseEvent) {
        if (!this.measureLine || !this.measureText) return;

        const rect = this.app.canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.worldContainer.x) / this.worldContainer.scale.x;
        const mouseY = (e.clientY - rect.top - this.worldContainer.y) / this.worldContainer.scale.y;

        const endX = Math.round(mouseX / this.gridSize) * this.gridSize;
        const endY = Math.round(mouseY / this.gridSize) * this.gridSize;

        const dx = (endX - this.measureStart.x) / this.gridSize;
        const dy = (endY - this.measureStart.y) / this.gridSize;
        const distanceCells = Math.sqrt(dx * dx + dy * dy);
        const distanceMeters = distanceCells * 1.5;

        this.measureLine.clear();
        this.measureLine.setStrokeStyle({ width: 2, color: 0xf59e0b, alpha: 0.8 });
        this.measureLine.moveTo(this.measureStart.x, this.measureStart.y);
        this.measureLine.lineTo(endX, endY);
        this.measureLine.stroke();

        // Círculo en el origen
        this.measureLine.circle(this.measureStart.x, this.measureStart.y, 4);
        this.measureLine.fill({ color: 0xf59e0b });

        // Círculo en el destino
        this.measureLine.circle(endX, endY, 4);
        this.measureLine.fill({ color: 0xf59e0b });

        this.measureText.text = `${distanceCells.toFixed(1)} casillas\n${distanceMeters.toFixed(1)} m`;
        this.measureText.x = endX + 8;
        this.measureText.y = endY - 20;
    }

    private stopMeasure() {
        this.isMeasuring = false;
        if (this.measureLine) {
            this.worldContainer.removeChild(this.measureLine);
            this.measureLine.destroy();
            this.measureLine = null;
        }
        if (this.measureText) {
            this.worldContainer.removeChild(this.measureText);
            this.measureText.destroy();
            this.measureText = null;
        }
    }
}