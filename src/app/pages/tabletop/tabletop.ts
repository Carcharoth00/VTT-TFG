import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
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
import { PixiCanvasService } from '../../services/pixi-canvas.service';

@Component({
  selector: 'app-tabletop',
  standalone: true,
  imports: [CommonModule, FormsModule, CharactersComponent, NotesComponent, DragDropModule],
  templateUrl: './tabletop.html',
  styleUrl: './tabletop.css',
})
export class Tabletop implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('pixiCanvas') pixiCanvas!: ElementRef<HTMLCanvasElement>;

  // Usuarios
  connectedUsers: { username: string, userId: number, role: string }[] = [];
  currentGame: Game | null = null;
  isGM = false;
  copiedToClipboard = false;

  // Librería
  libraryImages: LibraryItem[] = [];
  selectedLibraryImage: { name: string, image: string } | null = null;

  // Grid configuration
  gridSize = 50;
  gridColumns = 10;
  gridRows = 10;
  backgroundImage: string | null = null;
  showGrid = true;
  showMapModal = false;
  pendingMapFile: File | null = null;
  mapColumns = 20;
  mapRows = 15;
  freeMovement = false;

  //Iniciativa y combate
  combatActive = false;
  initiativeOrder: { tokenId: number, name: string, image: string | null, color: string }[] = [];
  currentTurn = 0;
  currentRound = 1;

  // Tokens
  tokens: Token[] = [];
  showTokenModal = false;
  myCharacters: Character[] = [];
  newTokenImage: string | null = null;
  newTokenName: string = '';
  newTokenColor: string = '#FF0000';
  selectedCharacterId: number | null = null;

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

  // Map
  maps: GameMap[] = [];
  activeMapId: number | null = null;

  // Dados
  Math = Math;
  diceModifier = 0;
  showDiceBuilder = false;
  diceBuilder = [
    { label: 'd4', sides: 4, count: 0 },
    { label: 'd6', sides: 6, count: 0 },
    { label: 'd8', sides: 8, count: 0 },
    { label: 'd10', sides: 10, count: 0 },
    { label: 'd12', sides: 12, count: 0 },
    { label: 'd20', sides: 20, count: 0 },
  ];

  readonly CONDITIONS = [
    { id: 'dead', icon: '💀', label: 'Muerto' },
    { id: 'unconscious', icon: '😴', label: 'Inconsciente' },
    { id: 'poisoned', icon: '🤢', label: 'Envenenado' },
    { id: 'burning', icon: '🔥', label: 'En llamas' },
    { id: 'stunned', icon: '⚡', label: 'Aturdido' },
    { id: 'protected', icon: '🛡️', label: 'Protegido' },
  ];

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    public authService: AuthService,
    private mapService: MapService,
    private gameService: GameService,
    private characterService: CharacterService,
    private libraryService: LibraryService,
    private pixiService: PixiCanvasService
  ) { }

  async ngAfterViewInit() {
    const canvas = this.pixiCanvas.nativeElement;
    const parent = canvas.parentElement!;
    await this.pixiService.init(canvas, parent.clientWidth, parent.clientHeight);

    this.pixiService.onTokenMoved = (tokenId, x, y) => {
      const token = this.tokens.find(t => t.id === tokenId);
      if (token) {
        token.x = x;
        token.y = y;
      }
      if (this.isConnected) {
        this.socket.emit('move-token', { roomId: this.roomId, tokenId, x, y });
      }
    };

    this.pixiService.onTokenClick = (tokenId) => {
      const token = this.tokens.find(t => t.id === tokenId);
      if (token) {
        this.pixiService.showTokenMenu(token, this.isGM, {
          onLock: () => this.toggleTokenLock(token),
          onDelete: () => this.removeToken(token.id),
          onCondition: (conditionId) => {
            const fakeEvent = new MouseEvent('click');
            this.toggleCondition(token, conditionId, fakeEvent);
          },
          onAddToInitiative: this.combatActive && this.isGM ? () => this.addToInitiative(token) : undefined,
          conditions: this.CONDITIONS
        });
      }
      this.cdr.detectChanges();
    };
  }

  ngOnInit() {
    window.addEventListener('keydown', this.handleKeyboard);
    this.authService.currentUser$.subscribe(user => {
      if (user && !this.isConnected) {
        this.username = user.username;
        this.route.params.subscribe(params => {
          this.roomId = params['id'];
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
                this.gridColumns = response.map.grid_cols || 20;
                this.gridRows = response.map.grid_rows || 15;
                this.gridSize = response.map.grid_size || 50;
                this.pixiService.setGridConfig(this.gridColumns, this.gridRows, this.gridSize);
                this.mapService.getMapImage(response.map.id).subscribe({
                  next: (img) => {
                    this.backgroundImage = img.image;
                    this.pixiService.setBackground(img.image);
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
    window.removeEventListener('keydown', this.handleKeyboard);
    this.pixiService.destroy();
  }

  private connectToRoom() {
    this.socket.connect();
    this.socket.emit('join-room', {
      roomId: this.roomId,
      username: this.username,
      userId: this.authService.getCurrentUser()?.id
    });
  }

  private initializeSocket() {
    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      autoConnect: false,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.cdr.markForCheck();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.cdr.markForCheck();
    });

    this.socket.on('room-state', (state: RoomState) => {
      this.tokens = state.tokens || [];
      this.freeMovement = state.freeMovement || false;
      this.pixiService.setFreeMovement(this.freeMovement);
      this.combatActive = state.combatActive || false;
      this.initiativeOrder = state.initiativeOrder || [];
      this.currentTurn = state.currentTurn || 0;

      if (state.gridConfig) {
        this.gridSize = state.gridConfig.size;
        this.gridColumns = state.gridConfig.columns;
        this.gridRows = state.gridConfig.rows;
        this.pixiService.setGridConfig(this.gridColumns, this.gridRows, this.gridSize);
      }
      this.backgroundImage = state.backgroundImage || null;
      this.chatMessages = state.chatMessages || [];
      this.pixiService.clearTokens();
      this.tokens.forEach(t => this.pixiService.addToken(t, this.isGM));
      if (this.backgroundImage) {
        this.pixiService.setBackground(this.backgroundImage);
      }
      this.cdr.markForCheck();
    });

    this.socket.on('token-added', (token: Token) => {
      const exists = this.tokens.find(t => t.id === token.id);
      if (!exists) {
        this.tokens.push(token);
        this.pixiService.addToken(token, this.isGM);
        this.cdr.markForCheck();
      }
    });

    this.socket.on('token-moved', (data: { id: number; x: number; y: number }) => {
      const token = this.tokens.find(t => t.id === data.id);
      if (token) {
        token.x = data.x;
        token.y = data.y;
        this.pixiService.updateTokenPosition(data.id, data.x, data.y);
        this.cdr.markForCheck();
      }
    });

    this.socket.on('token-removed', (tokenId: number) => {
      this.tokens = this.tokens.filter(t => t.id !== tokenId);
      this.pixiService.removeToken(tokenId);
      this.cdr.markForCheck();
    });

    this.socket.on('grid-updated', (config: GridConfig) => {
      this.gridSize = config.size;
      this.gridColumns = config.columns;
      this.gridRows = config.rows;
      this.pixiService.setGridConfig(config.columns, config.rows, config.size);
      this.cdr.markForCheck();
    });

    this.socket.on('background-updated', (data: { mapId: number } | null) => {
      if (data && data.mapId) {
        this.mapService.getMapImage(data.mapId).subscribe({
          next: (response) => {
            this.backgroundImage = response.image;
            this.pixiService.setBackground(response.image);
            this.cdr.detectChanges();
          }
        });
      } else {
        this.backgroundImage = null;
        this.pixiService.setBackground(null);
        this.cdr.detectChanges();
      }
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
        this.pixiService.updateTokenLocked(data.tokenId, data.locked);
        this.cdr.markForCheck();
      }
    });

    this.socket.on('token-conditions-updated', (data: { tokenId: number, conditions: string[] }) => {
      const token = this.tokens.find(t => t.id === data.tokenId);
      if (token) {
        token.conditions = data.conditions;
        this.pixiService.updateTokenConditions(data.tokenId, data.conditions);
        this.cdr.markForCheck();
      }
    });

    this.socket.on('free-movement-updated', (freeMovement: boolean) => {
      this.freeMovement = freeMovement;
      this.pixiService.setFreeMovement(freeMovement);
      this.cdr.markForCheck();
    });

    this.socket.on('combat-updated', (data: any) => {
      this.combatActive = data.combatActive;
      this.initiativeOrder = data.initiativeOrder;
      this.currentTurn = data.currentTurn;
      this.currentRound = data.currentRound || 1;
      if (data.combatActive) {
        this.highlightActiveTurn();
      } else {
        this.pixiService.clearHighlight();
      }
      this.cdr.markForCheck();
    });

  }

  leaveRoom() {
    if (this.roomId) {
      this.socket.emit('leave-room', this.roomId);
      this.socket.disconnect();
      this.roomId = '';
      this.isConnected = false;
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  goBack() {
    if (confirm('¿Seguro que quieres salir de la sala?')) {
      this.leaveRoom();
      this.tokens = [];
      this.chatMessages = [];
      this.backgroundImage = null;
    }
  }

  onImageUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.pendingMapFile = file;

    // Detectar dimensiones de la imagen automáticamente
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Sugerir columnas/filas basándose en la imagen
      this.mapColumns = Math.round(img.width / 70); // 70px por celda como sugerencia
      this.mapRows = Math.round(img.height / 70);
      URL.revokeObjectURL(url);
      this.showMapModal = true;
      this.cdr.detectChanges();
    };
    img.src = url;
  }

  confirmMapUpload() {
    if (!this.pendingMapFile) return;
    const file = this.pendingMapFile;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const imageData = e.target.result;

      // Calcular gridSize a partir de las dimensiones reales
      const img = new Image();
      img.onload = () => {
        const calculatedSize = Math.round(img.width / this.mapColumns);
        this.gridSize = calculatedSize;
        this.gridColumns = this.mapColumns;
        this.gridRows = this.mapRows;
        this.pixiService.setGridConfig(this.gridColumns, this.gridRows, this.gridSize);

        const mapName = file.name.replace(/\.[^/.]+$/, '');
        this.mapService.uploadMap(
          +this.roomId, mapName, imageData,
          { cols: this.gridColumns, rows: this.gridRows, size: this.gridSize }
        ).subscribe({
          next: (response) => {
            this.maps.push(response.map);
            this.activateMap(response.map.id);
          },
          error: () => console.error('Error subiendo mapa')
        });
        this.showMapModal = false;
        this.pendingMapFile = null;
      };
      img.src = imageData;
    };
    reader.readAsDataURL(file);
  }

  updateGridDimensions() {
    if (this.backgroundImage) {
      const img = new Image();
      img.onload = () => {
        this.gridSize = Math.round(img.width / this.gridColumns);
        this.pixiService.setGridConfig(this.gridColumns, this.gridRows, this.gridSize);
        if (this.isConnected) {
          this.socket.emit('update-grid', {
            roomId: this.roomId,
            config: { size: this.gridSize, columns: this.gridColumns, rows: this.gridRows }
          });
        }
      };
      img.src = this.backgroundImage;
    } else {
      this.pixiService.setGridConfig(this.gridColumns, this.gridRows, this.gridSize);
    }
  }

  activateMap(mapId: number) {
    this.mapService.activateMap(mapId, +this.roomId).subscribe({
      next: () => {
        this.activeMapId = mapId;
        this.mapService.getMapImage(mapId).subscribe({
          next: (response) => {
            this.backgroundImage = response.image;
            this.pixiService.setBackground(response.image);
            this.cdr.detectChanges();
            if (this.isConnected) {
              this.socket.emit('update-background', { roomId: this.roomId, mapId });
            }
          }
        });
      }
    });
  }

  removeBackground() {
    this.backgroundImage = null;
    this.pixiService.setBackground(null);
    if (this.isConnected) {
      this.socket.emit('update-background', { roomId: this.roomId, image: null });
    }
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    this.pixiService.toggleGrid(this.showGrid);
  }

  addToken() {
    this.newTokenImage = null;
    this.newTokenName = '';
    this.newTokenColor = '#FF0000';
    this.selectedCharacterId = null;
    this.showTokenModal = true;
    this.characterService.getMyCharacters(+this.roomId).subscribe({
      next: (response) => {
        this.myCharacters = response.characters;
        this.cdr.detectChanges();
      }
    });
    this.cdr.detectChanges();
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
      x: 0, y: 0,
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
    this.pixiService.removeToken(id);
    if (this.isConnected) {
      this.socket.emit('remove-token', { roomId: this.roomId, tokenId: id });
    }
  }

  toggleTokenLock(token: Token) {
    if (!this.isGM) return;
    const locked = !token.locked;
    this.socket.emit('toggle-lock', { roomId: this.roomId, tokenId: token.id, locked });
  }

  toggleCondition(token: Token, conditionId: string, event: MouseEvent) {
    event.stopPropagation();
    const conditions: string[] = token.conditions ? [...token.conditions] : [];
    const index = conditions.indexOf(conditionId);
    if (index === -1) conditions.push(conditionId);
    else conditions.splice(index, 1);
    token.conditions = conditions;
    this.pixiService.updateTokenConditions(token.id, conditions);
    this.socket.emit('update-conditions', { roomId: this.roomId, tokenId: token.id, conditions });
    this.cdr.detectChanges();
  }

  getConditionIcon(conditionId: string): string {
    return this.CONDITIONS.find(c => c.id === conditionId)?.icon || '';
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.isConnected) return;
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
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        userId: 'system',
        username: 'Sistema',
        message: `Fórmula inválida: ${formula}`,
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
    const cleanFormula = formula.trim().toLowerCase();
    const individualDice: { sides: number; result: number }[] = [];
    let total = 0;
    let modifier = 0;
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
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
  }

  formatTimestamp(date: Date): string {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
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
  };

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

  toggleFreeMovement() {
    if (!this.isGM) return;
    this.freeMovement = !this.freeMovement;
    this.pixiService.setFreeMovement(this.freeMovement);
    this.socket.emit('toggle-free-movement', { roomId: this.roomId, freeMovement: this.freeMovement });
  }

  startCombat() {
    if (!this.isGM) return;
    const initiativeOrder = this.tokens.map(t => ({
      tokenId: t.id,
      name: t.name || t.label || String(t.id),
      image: t.image || null,
      color: t.color
    }));
    this.socket.emit('start-combat', { roomId: this.roomId, initiativeOrder });
  }

  endCombat() {
    if (!this.isGM) return;
    this.pixiService.clearHighlight();
    this.socket.emit('end-combat', { roomId: this.roomId });
  }

  nextTurn() {
    if (!this.isGM) return;
    this.socket.emit('next-turn', { roomId: this.roomId });
  }

  prevTurn() {
    if (!this.isGM) return;
    this.socket.emit('prev-turn', { roomId: this.roomId });
  }

  onInitiativeReorder(event: CdkDragDrop<any[]>) {
    const order = [...this.initiativeOrder];
    const [moved] = order.splice(event.previousIndex, 1);
    order.splice(event.currentIndex, 0, moved);
    this.initiativeOrder = order;
    this.socket.emit('update-initiative-order', { roomId: this.roomId, initiativeOrder: order });
  }

  highlightActiveTurn() {
    if (!this.combatActive || this.initiativeOrder.length === 0) return;
    const activeToken = this.initiativeOrder[this.currentTurn];
    if (activeToken) {
      this.pixiService.highlightToken(activeToken.tokenId);
    }
  }

  addToInitiative(token: Token) {
    if (!this.isGM) return;
    const exists = this.initiativeOrder.find(e => e.tokenId === token.id);
    if (exists) return;

    const newOrder = [...this.initiativeOrder, {
      tokenId: token.id,
      name: token.name || token.label || String(token.id),
      image: token.image || null,
      color: token.color
    }];
    this.socket.emit('update-initiative-order', { roomId: this.roomId, initiativeOrder: newOrder });
  }

}