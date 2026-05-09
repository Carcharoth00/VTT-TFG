import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Note, NoteService } from '../../services/notes.service';

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notes.html',
  styleUrl: './notes.css'
})
export class NotesComponent implements OnInit {

  @Input() gameId!: number;

  notes: Note[] = [];
  selectedNote: Note | null = null;
  isEditing = false;
  error = '';

  editTitle = '';
  editContent = '';

  constructor(
    private noteService: NoteService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadNotes();
  }

  loadNotes() {
    this.noteService.getNotes(this.gameId).subscribe({
      next: (response) => {
        this.notes = response.notes;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Error al cargar las notas';
        this.cdr.detectChanges();
      }
    });
  }

  newNote() {
    this.selectedNote = null;
    this.editTitle = 'Nueva nota';
    this.editContent = '';
    this.isEditing = true;
    this.cdr.detectChanges();
  }

  openNote(note: Note) {
    this.noteService.getNote(this.gameId, note.id).subscribe({
      next: (response) => {
        this.selectedNote = response.note;
        this.editTitle = response.note.title;
        this.editContent = response.note.content;
        this.isEditing = true;
        this.cdr.detectChanges();
      }
    });
  }

  saveNote() {
    if (!this.editTitle.trim()) return;

    if (this.selectedNote) {
      this.noteService.update(this.selectedNote.id, this.editTitle, this.editContent).subscribe({
        next: (response) => {
          const index = this.notes.findIndex(n => n.id === response.note.id);
          if (index !== -1) this.notes[index] = response.note;
          this.isEditing = false;
          this.selectedNote = null;
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Error al guardar la nota';
          this.cdr.detectChanges();
        }
      });
    } else {
      this.noteService.create(this.gameId, this.editTitle, this.editContent).subscribe({
        next: (response) => {
          this.notes.unshift(response.note);
          this.isEditing = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Error al crear la nota';
          this.cdr.detectChanges();
        }
      });
    }
  }

  deleteNote(note: Note) {
    if (!confirm(`¿Eliminar "${note.title}"?`)) return;

    this.noteService.delete(note.id).subscribe({
      next: () => {
        this.notes = this.notes.filter(n => n.id !== note.id);
        if (this.selectedNote?.id === note.id) {
          this.isEditing = false;
          this.selectedNote = null;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Error al eliminar la nota';
        this.cdr.detectChanges();
      }
    });
  }

  cancel() {
    this.isEditing = false;
    this.selectedNote = null;
  }
}