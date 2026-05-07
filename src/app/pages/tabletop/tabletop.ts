import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { io, Socket } from 'socket.io-client';
import { Router } from '@angular/router';
import { Token, GridConfig, ChatMessage, DiceRoll, RoomState } from "../../model/interfaces";
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';
import { CharactersComponent } from '../characters/characters';
import { MapService, GameMap } from '../../services/map.service';

@Component({
  selector: 'app-tabletop',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, CharactersComponent],
  templateUrl: './tabletop.html',
  styleUrl: './tabletop.css',
})
export class Tabletop implements OnInit, OnDestroy {
  @ViewChild('gridWrapper') gridWrapper!: ElementRef;
  connectedUsers: { username: string, userId: number }[] = [];

  // Grid configuration
  gridSize = 50;
  gridColumns = 10;
  gridRows = 10;
  backgroundImage: string | null = null;
  zoomLevel = 1;

  // Tokens
  tokens: Token[] = [];
  nextTokenId = 1;

  // Socket.IO
  private socket!: Socket;
  roomId: string = '';
  isConnected = false;
  username: string = '';

  // Chat
  chatMessages: ChatMessage[] = [];
  newMessage: string = '';
  isChatOpen = true;
  isCharactersPanelOpen = false;

  //Map
  maps: GameMap[] = [];
  activeMapId: number | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    public authService: AuthService,
    private mapService: MapService
  ) {
    console.log('✅ Tabletop constructor - Router inyectado:', !!this.router);
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      if (user && !this.isConnected) {
        this.username = user.username;
        this.route.params.subscribe(params => {
          this.roomId = params['id'];
          this.initializeSocket();
          this.connectToRoom();
          this.mapService.getActiveMap(+this.roomId).subscribe({
            next: (response) => {
              if (response.map) {
                this.activeMapId = response.map.id;
                this.mapService.getMapImage(response.map.id).subscribe({
                  next: (img) => {
                    this.backgroundImage = img.image;
                    this.cdr.detectChanges();
                  }
                });
              }
            }
          });
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // ========== SOCKET.IO ==========

  private connectToRoom() {
    this.socket.connect();
    this.socket.emit('join-room', {
      roomId: this.roomId,
      username: this.username,
      userId: this.authService.getCurrentUser()?.id
    });
  }
  private initializeSocket() {
    // Conectar al servidor Socket.IO (ajusta la URL según tu backend)
    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      autoConnect: false,
    });

    // Eventos de conexión
    this.socket.on('connect', () => {
      console.log('Conectado al servidor Socket.IO');
      this.isConnected = true;
      this.cdr.markForCheck();
    });

    this.socket.on('disconnect', () => {
      console.log('Desconectado del servidor');
      this.isConnected = false;
      this.cdr.markForCheck();
    });

    // Recibir estado inicial de la sala
    this.socket.on('room-state', (state: RoomState) => {
      this.tokens = state.tokens || [];
      if (state.gridConfig) {
        this.gridSize = state.gridConfig.size;
        this.gridColumns = state.gridConfig.columns;
        this.gridRows = state.gridConfig.rows;
      }
      this.backgroundImage = state.backgroundImage || null;
      this.zoomLevel = state.zoomLevel || 1;
      this.chatMessages = state.chatMessages || [];
      this.cdr.markForCheck();
    });

    // Sincronizar tokens
    this.socket.on('token-added', (token: Token) => {
      const exists = this.tokens.find(t => t.id === token.id);
      if (!exists) {
        this.tokens.push(token);
        this.cdr.markForCheck();
      }
    });

    this.socket.on('token-moved', (data: { id: number; x: number; y: number }) => {
      const token = this.tokens.find(t => t.id === data.id);
      if (token) {
        token.x = data.x;
        token.y = data.y;
        this.cdr.markForCheck();
      }
    });

    this.socket.on('token-removed', (tokenId: number) => {
      this.tokens = this.tokens.filter(t => t.id !== tokenId);
      this.cdr.markForCheck();
    });

    // Sincronizar configuración
    this.socket.on('grid-updated', (config: GridConfig) => {
      this.gridSize = config.size;
      this.gridColumns = config.columns;
      this.gridRows = config.rows;
      this.cdr.markForCheck();
    });

    this.socket.on('background-updated', (data: { mapId: number } | null) => {
      if (data && data.mapId) {
        this.mapService.getMapImage(data.mapId).subscribe({
          next: (response) => {
            this.backgroundImage = response.image;
            this.cdr.detectChanges();
          }
        });
      } else {
        this.backgroundImage = null;
        this.cdr.detectChanges();
      }
    });

    this.socket.on('zoom-updated', (zoom: number) => {
      this.zoomLevel = zoom;
      this.cdr.markForCheck();
    });

    // Chat events
    this.socket.on('chat-message', (message: ChatMessage) => {
      this.chatMessages.push(message);
      this.cdr.markForCheck();
      this.scrollChatToBottom();
    });

    this.socket.on('dice-rolled', (message: ChatMessage) => {
      this.chatMessages.push(message);
      this.cdr.markForCheck();
      this.scrollChatToBottom();
    });

    this.socket.on('system-message', (message: ChatMessage) => {
      this.chatMessages.push(message);
      this.cdr.markForCheck();
      this.scrollChatToBottom();
    });

    this.socket.on('users-updated', (users: { username: string, userId: number }[]) => {
      this.connectedUsers = users;
      this.cdr.markForCheck();
    });
  }

  joinRoom() {
    if (this.roomId.trim() && this.username.trim()) {
      this.socket.connect();
      this.socket.emit('join-room', { roomId: this.roomId, username: this.username });
    }
  }

  leaveRoom() {
    console.log('🔴 leaveRoom() llamado');
    console.log('🔴 Router disponible:', !!this.router);

    if (this.roomId) {
      this.socket.emit('leave-room', this.roomId);
      this.socket.disconnect();
      this.roomId = '';
      this.isConnected = false;

      console.log('🔴 Intentando navegar a /dashboard...');

      // Navegación con promesa para debug
      this.router.navigate(['/dashboard']).then(
        success => console.log('✅ Navegación exitosa:', success),
        error => console.error('❌ Error en navegación:', error)
      );
    } else {
      console.warn('⚠️ No hay roomId, navegando de todos modos...');
      this.router.navigate(['/dashboard']);
    }
  }

  goBack() {
    console.log('🔴 goBack() llamado');

    // Confirmar antes de salir
    const confirmLeave = confirm('¿Seguro que quieres salir de la sala?');
    console.log('🔴 Confirmación del usuario:', confirmLeave);

    if (confirmLeave) {
      console.log('🔴 Usuario confirmó, llamando a leaveRoom()');
      this.leaveRoom();

      // Limpiar datos locales
      this.tokens = [];
      this.chatMessages = [];
      this.backgroundImage = null;
      this.zoomLevel = 1;

      console.log('🔴 Datos locales limpiados');
    } else {
      console.log('🔴 Usuario canceló la salida');
    }
  }

  // ========== GRID & ZOOM ==========

  getScaledGridSize(): number {
    return this.gridSize * this.zoomLevel;
  }

  zoomIn() {
    if (this.zoomLevel < 3) {
      this.zoomLevel += 0.2;
      this.emitZoomUpdate();
      this.cdr.markForCheck();
    }
  }

  zoomOut() {
    if (this.zoomLevel > 0.5) {
      this.zoomLevel -= 0.2;
      this.emitZoomUpdate();
      this.cdr.markForCheck();
    }
  }

  resetZoom() {
    this.zoomLevel = 1;
    this.emitZoomUpdate();
    this.cdr.markForCheck();
  }

  private emitZoomUpdate() {
    if (this.isConnected) {
      this.socket.emit('update-zoom', { roomId: this.roomId, zoom: this.zoomLevel });
    }
  }

  updateGridDimensions() {
    console.log(`Grid actualizado: ${this.gridColumns}x${this.gridRows}, tamaño celda: ${this.gridSize}px`);

    if (this.isConnected) {
      const config: GridConfig = {
        size: this.gridSize,
        columns: this.gridColumns,
        rows: this.gridRows,
      };
      this.socket.emit('update-grid', { roomId: this.roomId, config });
    }
  }

  // ========== BACKGROUND IMAGE ==========

  onImageUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const imageData = e.target.result;
      const mapName = file.name.replace(/\.[^/.]+$/, '');

      this.mapService.uploadMap(
        +this.roomId,
        mapName,
        imageData,
        { cols: this.gridColumns, rows: this.gridRows, size: this.gridSize }
      ).subscribe({
        next: (response) => {
          this.maps.push(response.map);
          this.activateMap(response.map.id);
        },
        error: () => console.error('Error subiendo mapa')
      });
    };
    reader.readAsDataURL(file);
  }

  activateMap(mapId: number) {
    this.mapService.activateMap(mapId, +this.roomId).subscribe({
      next: () => {
        this.activeMapId = mapId;
        this.mapService.getMapImage(mapId).subscribe({
          next: (response) => {
            this.backgroundImage = response.image;
            this.cdr.detectChanges();
            if (this.isConnected) {
              this.socket.emit('update-background', {
                roomId: this.roomId,
                mapId: mapId
              });
            }
          }
        });
      }
    });
  }

  removeBackground() {
    this.backgroundImage = null;
    if (this.isConnected) {
      this.socket.emit('update-background', {
        roomId: this.roomId,
        image: null,
      });
    }
  }

  // ========== TOKENS (CDK Drag & Drop) ==========

  addToken() {
    console.log('addToken llamado, isConnected:', this.isConnected, 'roomId:', this.roomId);
    if (!this.isConnected) return;

    const token = {
      x: 0,
      y: 0,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
      label: `T${Date.now() % 1000}`,
    };

    this.socket.emit('add-token', { roomId: this.roomId, token });
  }

  removeToken(id: number) {
    this.tokens = this.tokens.filter(t => t.id !== id);

    if (this.isConnected) {
      this.socket.emit('remove-token', { roomId: this.roomId, tokenId: id });
    }
  }

  // CDK Drag Drop Event
  onTokenDragEnded(event: CdkDragEnd, token: Token) {
    const scaledGridSize = this.getScaledGridSize();
    const distance = event.distance;

    // Calcular nueva posición basada en el desplazamiento
    const deltaX = distance.x;
    const deltaY = distance.y;

    // Calcular nueva posición en celdas
    const currentPixelX = token.x * scaledGridSize;
    const currentPixelY = token.y * scaledGridSize;

    const newPixelX = currentPixelX + deltaX;
    const newPixelY = currentPixelY + deltaY;

    // Convertir a coordenadas de celda
    let newX = Math.round(newPixelX / scaledGridSize);
    let newY = Math.round(newPixelY / scaledGridSize);

    // Limitar a los bordes de la cuadrícula
    newX = Math.max(0, Math.min(newX, this.gridColumns - 1));
    newY = Math.max(0, Math.min(newY, this.gridRows - 1));

    // Actualizar posición del token
    token.x = newX;
    token.y = newY;

    // Emitir actualización
    if (this.isConnected) {
      this.socket.emit('move-token', {
        roomId: this.roomId,
        tokenId: token.id,
        x: newX,
        y: newY,
      });
    }

    this.cdr.markForCheck();
  }

  // Obtener el ID del token para el trackBy
  trackByTokenId(index: number, token: Token): number {
    return token.id;
  }

  // Generar array para la cuadrícula
  getGridCells(): number[] {
    return Array(this.gridColumns * this.gridRows).fill(0).map((_, i) => i);
  }

  // ========== CHAT ==========

  toggleChat() {
    this.isChatOpen = !this.isChatOpen;
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.isConnected) return;

    // Verificar si es un comando de dado (ej: /roll 2d6+3, /r d20)
    const diceRegex = /^\/r(?:oll)?\s+(.+)$/i;
    const match = this.newMessage.trim().match(diceRegex);

    if (match) {
      this.rollDice(match[1].trim());
    } else {
      const message: ChatMessage = {
        id: Date.now().toString(),
        userId: this.socket.id || '',
        username: this.username,
        message: this.newMessage,
        timestamp: new Date(),
        type: 'message',
      };

      this.socket.emit('send-message', { roomId: this.roomId, message });
    }

    this.newMessage = '';
  }

  rollDice(formula: string) {
    const diceRoll = this.parseDiceFormula(formula);

    if (!diceRoll) {
      // Fórmula inválida
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        userId: 'system',
        username: 'Sistema',
        message: `Fórmula de dados inválida: ${formula}. Usa formato como "2d6+3", "d20", "3d8-2"`,
        timestamp: new Date(),
        type: 'system',
      };
      this.chatMessages.push(errorMessage);
      this.scrollChatToBottom();
      return;
    }

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: this.socket.id || '',
      username: this.username,
      message: `Tiró ${formula}`,
      timestamp: new Date(),
      type: 'dice',
      diceRoll,
    };

    this.socket.emit('roll-dice', { roomId: this.roomId, message });
  }

  parseDiceFormula(formula: string): DiceRoll | null {
    // Formato: NdX+M o NdX-M o dX o NdX
    // Ejemplos: 2d6+3, d20, 3d8-2, 4d6
    const regex = /^(\d*)d(\d+)([+\-]\d+)?$/i;
    const match = formula.trim().match(regex);

    if (!match) return null;

    const count = match[1] ? parseInt(match[1]) : 1;
    const sides = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;

    if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
      return null;
    }

    const results: number[] = [];
    const individualDice: { sides: number; result: number }[] = [];

    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      results.push(roll);
      individualDice.push({ sides, result: roll });
    }

    const total = results.reduce((sum, r) => sum + r, 0) + modifier;

    return {
      formula,
      results,
      total,
      individualDice,
    };
  }

  private scrollChatToBottom() {
    setTimeout(() => {
      const chatContainer = document.querySelector('.chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  }

  formatTimestamp(date: Date): string {
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Atajos de teclado para dados comunes
  quickRoll(formula: string) {
    this.rollDice(formula);
  }
}