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
import { GameService, Game } from '../../services/game.service';
import { NotesComponent } from '../notes/notes';
import { Character, CharacterService } from '../../services/character.service';
import { LibraryItem, LibraryService } from '../../services/library.service';

@Component({
  selector: 'app-tabletop',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, CharactersComponent, NotesComponent],
  templateUrl: './tabletop.html',
  styleUrl: './tabletop.css',
})
export class Tabletop implements OnInit, OnDestroy {
  @ViewChild('canvasViewport') canvasViewport!: ElementRef;

  //Usuarios
  connectedUsers: { username: string, userId: number, role: string }[] = [];
  currentGame: Game | null = null;
  isGM = false;
  copiedToClipboard = false;

  //Libreria
  libraryImages: LibraryItem[] = [];
  selectedLibraryImage: { name: string, image: string } | null = null;

  // Grid configuration
  gridSize = 50;
  gridColumns = 10;
  gridRows = 10;
  backgroundImage: string | null = null;
  zoomLevel = 1;
  panX = 0;
  panY = 0;
  showGrid = true;
  private isPanning = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Tokens
  tokens: Token[] = [];
  nextTokenId = 1;
  showTokenModal = false;
  myCharacters: Character[] = [];
  newTokenImage: string | null = null;
  newTokenName: string = '';
  newTokenColor: string = '#FF0000';
  selectedCharacterId: number | null = null;
  activeTokenMenu: number | null = null;

  // Socket.IO
  private socket!: Socket;
  roomId: string = '';
  isConnected = false;
  username: string = '';

  // Chat
  activePanel: 'chat' | 'characters' | 'notes' | 'library' = 'chat';
  chatMessages: ChatMessage[] = [];
  newMessage: string = '';
  showLeftPanel = true;
  showRightPanel = true;
  unreadMessages = 0;

  //Map
  maps: GameMap[] = [];
  activeMapId: number | null = null;

  // Dados
  Math = Math;
  diceModifier = 0;
  showDiceBuilder = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    public authService: AuthService,
    private mapService: MapService,
    private gameService: GameService,
    private characterService: CharacterService,
    private libraryService: LibraryService
  ) {
    console.log('✅ Tabletop constructor - Router inyectado:', !!this.router);
  }

  ngOnInit() {
    window.addEventListener('keydown', this.handleKeyboard);
    document.addEventListener('click', () => {
      this.activeTokenMenu = null;
      this.cdr.detectChanges();
    });
    this.authService.currentUser$.subscribe(user => {
      if (user && !this.isConnected) {
        this.username = user.username;
        this.route.params.subscribe(params => {
          this.roomId = params['id'];
          const viewportWidth = window.innerWidth - 600; // restar paneles laterales aprox
          const viewportHeight = window.innerHeight;
          this.panX = (viewportWidth - this.gridColumns * this.gridSize) / 2;
          this.panY = (viewportHeight - this.gridRows * this.gridSize) / 2;
          this.libraryService.getItems(+this.roomId).subscribe({
            next: (response) => {
              this.libraryImages = response.items;
              this.cdr.detectChanges();
            }
          });
          this.gameService.getGame(+this.roomId).subscribe({
            next: (response) => {
              this.currentGame = response.game;
              this.isGM = response.role === 'gm';
              this.cdr.detectChanges();
            }
          });
          this.characterService.getMyCharacters(+this.roomId).subscribe({
            next: (response) => {
              this.myCharacters = response.characters;
            }
          });
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
      window.removeEventListener('keydown', this.handleKeyboard);
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

    // ================ Chat events ===============
    this.socket.on('chat-message', (message: ChatMessage) => {
      this.chatMessages.push(message);
      this.cdr.markForCheck();
      this.scrollChatToBottom();
    });

    this.socket.on('chat-message', (message: ChatMessage) => {
      this.chatMessages.push(message);
      if (this.activePanel !== 'chat') this.unreadMessages++;
      this.cdr.markForCheck();
      this.scrollChatToBottom();
    });

    this.socket.on('dice-rolled', (message: ChatMessage) => {
      this.chatMessages.push(message);
      if (this.activePanel !== 'chat') this.unreadMessages++;
      this.cdr.markForCheck();
      this.scrollChatToBottom();
    });

    // =============== DADOS ================
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

    this.socket.on('users-updated', (users: { username: string, userId: number, role: string }[]) => {
      this.connectedUsers = users.map(u => ({ ...u, role: u.role || 'player' }));
      this.cdr.markForCheck();
    });

    this.socket.on('token-locked', (data: { tokenId: number, locked: boolean }) => {
      const token = this.tokens.find(t => t.id === data.tokenId);
      if (token) {
        token.locked = data.locked;
        this.cdr.markForCheck();
      }
    });

    this.socket.on('token-conditions-updated', (data: { tokenId: number, conditions: string[] }) => {
      const token = this.tokens.find(t => t.id === data.tokenId);
      if (token) {
        token.conditions = data.conditions;
        this.cdr.markForCheck();
      }
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
      this.cdr.markForCheck();
    }
  }

  zoomOut() {
    if (this.zoomLevel > 0.5) {
      this.zoomLevel -= 0.2;
      this.cdr.markForCheck();
    }
  }

  setZoom(event: any) {
    const value = parseInt(event.target.value);
    if (value >= 50 && value <= 300) {
      this.zoomLevel = value / 100;
      this.cdr.markForCheck();
    }
  }

  resetZoom() {
    this.zoomLevel = 1;
    this.cdr.markForCheck();
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

  onWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.min(3, Math.max(0.3, Math.round((this.zoomLevel + delta) * 10) / 10));

    const main = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = event.clientX - main.left;
    const mouseY = event.clientY - main.top;

    // Ajustar pan para que el zoom sea desde el cursor
    this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoomLevel);
    this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoomLevel);

    this.zoomLevel = newZoom;
    this.cdr.markForCheck();
  }

  onCanvasMouseDown(event: MouseEvent) {
    if (event.button === 1 || (event.button === 0 && event.altKey)) {
      this.isPanning = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      event.preventDefault();
    }
  }

  onCanvasMouseMove(event: MouseEvent) {
    if (!this.isPanning) return;
    const dx = event.clientX - this.lastMouseX;
    const dy = event.clientY - this.lastMouseY;
    this.panX += dx;
    this.panY += dy;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.cdr.markForCheck();
  }

  onCanvasMouseUp(event: MouseEvent) {
    this.isPanning = false;
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
    this.newTokenImage = null;
    this.newTokenName = '';
    this.newTokenColor = '#FF0000';
    this.selectedCharacterId = null;
    this.showTokenModal = true;
    this.cdr.detectChanges();

    this.characterService.getMyCharacters(+this.roomId).subscribe({
      next: (response) => {
        this.myCharacters = response.characters;
        this.cdr.detectChanges();
      }
    });
  }

  selectCharacterForToken(character: Character) {
    this.newTokenImage = character.avatar || null;
    this.newTokenName = character.name;
    this.selectedCharacterId = character.id;
    this.cdr.detectChanges();
  }

  onTokenImageUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.newTokenImage = e.target.result;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  confirmAddToken() {
    if (!this.isConnected) return;

    const token = {
      x: 0,
      y: 0,
      color: this.newTokenColor,
      label: this.newTokenName || `T${Date.now() % 1000}`,
      image: this.newTokenImage,
      name: this.newTokenName || null,
      character_id: this.selectedCharacterId
    };

    this.socket.emit('add-token', { roomId: this.roomId, token });
    this.showTokenModal = false;
    this.cdr.detectChanges();
  }

  removeToken(id: number) {
    this.tokens = this.tokens.filter(t => t.id !== id);

    if (this.isConnected) {
      this.socket.emit('remove-token', { roomId: this.roomId, tokenId: id });
    }
  }

  toggleTokenMenu(tokenId: number, event: MouseEvent) {
    event.stopPropagation();
    this.activeTokenMenu = this.activeTokenMenu === tokenId ? null : tokenId;
    this.cdr.detectChanges();
  }

  // CDK Drag Drop Event
  onTokenDragEnded(event: CdkDragEnd, token: Token) {
    const distance = event.distance;
    const deltaX = distance.x / this.zoomLevel;
    const deltaY = distance.y / this.zoomLevel;

    const currentPixelX = token.x * this.gridSize;
    const currentPixelY = token.y * this.gridSize;

    const newPixelX = currentPixelX + deltaX;
    const newPixelY = currentPixelY + deltaY;

    let newX = Math.round(newPixelX / this.gridSize);
    let newY = Math.round(newPixelY / this.gridSize);

    newX = Math.max(0, Math.min(newX, this.gridColumns - 1));
    newY = Math.max(0, Math.min(newY, this.gridRows - 1));

    token.x = newX;
    token.y = newY;

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

  readonly CONDITIONS = [
    { id: 'dead', icon: '💀', label: 'Muerto' },
    { id: 'unconscious', icon: '😴', label: 'Inconsciente' },
    { id: 'poisoned', icon: '🤢', label: 'Envenenado' },
    { id: 'burning', icon: '🔥', label: 'En llamas' },
    { id: 'stunned', icon: '⚡', label: 'Aturdido' },
    { id: 'protected', icon: '🛡️', label: 'Protegido' },
  ];

  toggleCondition(token: Token, conditionId: string, event: MouseEvent) {
    event.stopPropagation();
    const conditions: string[] = token.conditions ? [...token.conditions] : [];
    const index = conditions.indexOf(conditionId);
    if (index === -1) {
      conditions.push(conditionId);
    } else {
      conditions.splice(index, 1);
    }
    token.conditions = conditions;
    this.socket.emit('update-conditions', { roomId: this.roomId, tokenId: token.id, conditions });
    this.cdr.detectChanges();
  }

  getConditionIcon(conditionId: string): string {
    return this.CONDITIONS.find(c => c.id === conditionId)?.icon || '';
  }

  // ========== CHAT ==========

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

  allDiceEmpty(): boolean {
    return this.diceBuilder.every(d => d.count === 0);
  }

  parseDiceFormula(formula: string): DiceRoll | null {
    // Acepta: 2d6+1d8+3, d20, 3d8-2, 4d6, 2d6+1d4-1
    const cleanFormula = formula.trim().toLowerCase();

    const individualDice: { sides: number; result: number }[] = [];
    let total = 0;
    let modifier = 0;

    // Separar en partes por + y -
    const parts = cleanFormula.split(/(?=[+\-])/);

    for (const part of parts) {
      const diceMatch = part.match(/^([+\-]?)(\d*)d(\d+)$/i);
      const modMatch = part.match(/^([+\-]?\d+)$/);

      if (diceMatch) {
        const sign = diceMatch[1] === '-' ? -1 : 1;
        const count = diceMatch[2] ? parseInt(diceMatch[2]) : 1;
        const sides = parseInt(diceMatch[3]);

        if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;

        for (let i = 0; i < count; i++) {
          const result = Math.floor(Math.random() * sides) + 1;
          individualDice.push({ sides, result: result * sign });
          total += result * sign;
        }
      } else if (modMatch) {
        modifier += parseInt(modMatch[1]);
      } else {
        return null;
      }
    }

    if (individualDice.length === 0) return null;

    total += modifier;

    return {
      formula,
      results: individualDice.map(d => d.result),
      total,
      individualDice: individualDice.map(d => ({ sides: d.sides, result: Math.abs(d.result) }))
    };
  }

  maxZero(n: number): number {
    return Math.max(0, n);
  }

  diceBuilder = [
    { label: 'd4', sides: 4, count: 0 },
    { label: 'd6', sides: 6, count: 0 },
    { label: 'd8', sides: 8, count: 0 },
    { label: 'd10', sides: 10, count: 0 },
    { label: 'd12', sides: 12, count: 0 },
    { label: 'd20', sides: 20, count: 0 },
  ];

  rollDiceBuilder() {
    const activeDice = this.diceBuilder.filter(d => d.count > 0);
    if (activeDice.length === 0) return;

    const individualDice: { sides: number, result: number }[] = [];
    let total = this.diceModifier;

    for (const die of activeDice) {
      for (let i = 0; i < die.count; i++) {
        const result = Math.floor(Math.random() * die.sides) + 1;
        individualDice.push({ sides: die.sides, result });
        total += result;
      }
    }

    const formula = activeDice.map(d => `${d.count}${d.label}`).join('+')
      + (this.diceModifier !== 0 ? (this.diceModifier > 0 ? '+' : '') + this.diceModifier : '');

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: this.socket.id || '',
      username: this.username,
      message: `Tiró ${formula}`,
      timestamp: new Date(),
      type: 'dice',
      diceRoll: { formula, results: individualDice.map(d => d.result), total, individualDice }
    };

    this.socket.emit('roll-dice', { roomId: this.roomId, message });
  }

  resetDiceBuilder() {
    this.diceBuilder.forEach(d => d.count = 0);
    this.diceModifier = 0;
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

  onLibraryImageUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.libraryService.addItem(+this.roomId, file.name, e.target.result).subscribe({
        next: (response) => {
          this.libraryImages.unshift(response.item);
          this.cdr.detectChanges();
        }
      });
    };
    reader.readAsDataURL(file);
  }

  placeLibraryToken(img: { name: string, image: string }) {
    if (!this.isConnected) return;
    const token = {
      x: 0, y: 0,
      color: '#FF0000',
      label: img.name,
      image: img.image,
      name: img.name
    };
    this.socket.emit('add-token', { roomId: this.roomId, token });
  }

  removeLibraryImage(item: LibraryItem) {
    this.libraryService.deleteItem(+this.roomId, item.id).subscribe({
      next: () => {
        this.libraryImages = this.libraryImages.filter(i => i.id !== item.id);
        this.cdr.detectChanges();
      }
    });
  }

  private handleKeyboard = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.showTokenModal = false;
      this.showDiceBuilder = false;
      this.selectedLibraryImage = null;
      this.cdr.detectChanges();
    }
    if (e.key === '+' && e.ctrlKey) { e.preventDefault(); this.zoomIn(); }
    if (e.key === '-' && e.ctrlKey) { e.preventDefault(); this.zoomOut(); }
  };

  //Compartir partida
  async shareGame() {
    const code = this.currentGame?.invite_code;
    const url = `${window.location.origin}/join/${code}`;
    const text = `¡Te invito a unirte a mi partida "${this.currentGame?.name}" en VTT!`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Invitación a partida VTT', text, url });
      } catch (e) { }
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      this.copiedToClipboard = true;
      setTimeout(() => { this.copiedToClipboard = false; this.cdr.detectChanges(); }, 3000);
      this.cdr.detectChanges();
    }
  }

  shareViaWhatsApp() {
    const code = this.currentGame?.invite_code;
    const url = `${window.location.origin}/join/${code}`;
    const text = encodeURIComponent(`¡Te invito a unirte a mi partida "${this.currentGame?.name}" en VTT! Entra aquí: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  toggleMemberRole(user: { username: string, userId: number, role: string }) {
    const newRole = user.role === 'gm' ? 'player' : 'gm';
    this.gameService.updateMemberRole(+this.roomId, user.userId, newRole).subscribe({
      next: () => {
        user.role = newRole;
        this.cdr.detectChanges();
      },
      error: () => console.error('Error cambiando rol')
    });
  }

  toggleTokenLock(token: Token) {
    if (!this.isGM) return;
    const locked = !token.locked;
    this.socket.emit('toggle-lock', { roomId: this.roomId, tokenId: token.id, locked });
  }

}