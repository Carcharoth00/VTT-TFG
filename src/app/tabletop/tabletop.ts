import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tabletop',
  imports: [CommonModule, FormsModule],
  templateUrl: './tabletop.html',
  styleUrl: './tabletop.css',
})
export class Tabletop {
  @ViewChild('gridWrapper') gridWrapper!: ElementRef;

  gridSize = 50; // Tamaño de cada celda en píxeles
  gridColumns = 10; // Número de columnas
  gridRows = 10; // Número de filas
  backgroundImage: string | null = null;
  zoomLevel = 1;

  // Array para almacenar tokens
  tokens: { id: number; x: number; y: number; color: string }[] = [];
  nextTokenId = 1;

  // Variables para drag and drop
  draggingToken: { id: number; x: number; y: number; color: string } | null = null;
  dragOffsetX = 0;
  dragOffsetY = 0;

  constructor(private cdr: ChangeDetectorRef) { }

  //Caputar tamaño de celda escalado para escalar los tokens
  getScaledGridSize(): number {
    return this.gridSize * this.zoomLevel;
  }

  // Zoom IN
  zoomIn() {
    if (this.zoomLevel < 3) {
      this.zoomLevel += 0.2;
      this.cdr.markForCheck();
    }
  }

  // Zoom OUT
  zoomOut() {
    if (this.zoomLevel > 0.5) {
      this.zoomLevel -= 0.2;
      this.cdr.markForCheck();
    }
  }

  //Reset Zoom
  resetZoom() {
    this.zoomLevel = 1;
    this.cdr.markForCheck();
  }

  // Actualizar dimensiones de la cuadrícula
  updateGridDimensions() {
    console.log(`Grid actualizado: ${this.gridColumns}x${this.gridRows}, tamaño celda: ${this.gridSize}px`);
  }

  // Subir imagen de fondo
  onImageUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.backgroundImage = e.target.result;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }
  }

  // Agregar token a la cuadrícula
  addToken() {
    const token = {
      id: this.nextTokenId++,
      x: 0,
      y: 0,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16),
    };
    this.tokens.push(token);
  }

  // Iniciar drag
  startDrag(event: MouseEvent, token: { id: number; x: number; y: number; color: string }) {
    event.preventDefault();
    this.draggingToken = token;

    // Calcular offset del ratón respecto a la posición del token
    const tokenElement = (event.target as HTMLElement).closest('.token') as HTMLElement;
    if (tokenElement) {
      const rect = tokenElement.getBoundingClientRect();
      this.dragOffsetX = event.clientX - rect.left;
      this.dragOffsetY = event.clientY - rect.top;
    }

    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.endDrag.bind(this));
  }

  // Durante el drag
  onMouseMove = (event: MouseEvent) => {
    if (!this.draggingToken || !this.gridWrapper) return;

    const gridElement = this.gridWrapper.nativeElement;
    const gridRect = gridElement.getBoundingClientRect();
    const scaledGridSize = this.getScaledGridSize();

    // Calcular posición del ratón relativa a la cuadrícula
    let mouseX = event.clientX - gridRect.left - this.dragOffsetX;
    let mouseY = event.clientY - gridRect.top - this.dragOffsetY;

    // Limitar a los bordes de la cuadrícula (usando scaledGridSize)
    mouseX = Math.max(0, Math.min(mouseX, gridRect.width - scaledGridSize));
    mouseY = Math.max(0, Math.min(mouseY, gridRect.height - scaledGridSize));

    // Convertir píxeles a celdas de la cuadrícula (usando scaledGridSize)
    this.draggingToken.x = Math.floor(mouseX / scaledGridSize);
    this.draggingToken.y = Math.floor(mouseY / scaledGridSize);

    // Limitar a las dimensiones de la cuadrícula
    this.draggingToken.x = Math.min(this.draggingToken.x, this.gridColumns - 1);
    this.draggingToken.y = Math.min(this.draggingToken.y, this.gridRows - 1);

    this.cdr.markForCheck();
  };

  // Finalizar drag
  endDrag = () => {
    this.draggingToken = null;
    this.cdr.markForCheck();
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('mouseup', this.endDrag.bind(this));
  };

  // Eliminar token
  removeToken(id: number) {
    this.tokens = this.tokens.filter(t => t.id !== id);
  }


}
