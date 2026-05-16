import { CommonModule } from '@angular/common';
import { Output, EventEmitter } from '@angular/core';
import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CharacterService, Character, CharacterStats, CharacterAttack } from '../../services/character.service';

@Component({
  selector: 'app-characters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './characters.html',
  styleUrl: './characters.css'
})
export class CharactersComponent implements OnInit {
  @Output() onRollAttack = new EventEmitter<{ attack: CharacterAttack, character: Character }>();
  @Output() onHPChange = new EventEmitter<{ characterId: number, hp: number, max_hp: number }>();
  @Input() gameId!: number;
  @Input() currentUserId!: number;

  characters: Character[] = [];
  showCreateForm = false;
  editingCharacter: Character | null = null;
  error = '';

  // Formulario
  form: {
    name: string;
    hp: number;
    max_hp: number;
    ac: number;
    notes: string;
    avatar: string | null;
    stats: CharacterStats;
    skills: CharacterAttack[];
  } = {
      name: '',
      hp: 10,
      max_hp: 10,
      ac: 10,
      notes: '',
      avatar: null,
      stats: {
        fuerza: 10, destreza: 10, constitucion: 10,
        inteligencia: 10, sabiduria: 10, carisma: 10
      },
      skills: []
    };

  constructor(
    private characterService: CharacterService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadCharacters();
  }

  loadCharacters() {
    this.characterService.getByGame(this.gameId).subscribe({
      next: (response) => {
        this.characters = response.characters;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Error al cargar las fichas';
        this.cdr.detectChanges();
      }
    });
  }

  openCreateForm() {
    this.editingCharacter = null;
    this.resetForm();
    this.showCreateForm = true;
    this.cdr.detectChanges();
  }

  openEditForm(character: Character) {
    this.editingCharacter = character;
    this.form = {
      name: character.name,
      hp: character.hp,
      max_hp: character.max_hp,
      ac: character.ac,
      notes: character.notes || '',
      avatar: character.avatar || null,
      skills: character.skills || [],
      stats: character.stats || {
        fuerza: 10, destreza: 10, constitucion: 10,
        inteligencia: 10, sabiduria: 10, carisma: 10
      }
    };
    this.showCreateForm = true;
    this.cdr.detectChanges();
  }

  saveCharacter() {
    if (!this.form.name.trim()) return;

    if (this.editingCharacter) {
      this.characterService.update(this.editingCharacter.id, this.form).subscribe({
        next: (response) => {
          const index = this.characters.findIndex(c => c.id === response.character.id);
          if (index !== -1) this.characters[index] = response.character;
          this.onHPChange.emit({
            characterId: response.character.id,
            hp: response.character.hp,
            max_hp: response.character.max_hp
          });
          this.showCreateForm = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Error al actualizar la ficha';
          this.cdr.detectChanges();
        }
      });
    } else {
      this.characterService.create(this.gameId, this.form).subscribe({
        next: (response) => {
          this.characters.push(response.character);
          this.onHPChange.emit({
            characterId: response.character.id,
            hp: response.character.hp,
            max_hp: response.character.max_hp
          });
          this.showCreateForm = false;
          this.resetForm();
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Error al crear la ficha';
          this.cdr.detectChanges();
        }
      });
    }
  }

  deleteCharacter(character: Character) {
    if (!confirm(`¿Eliminar la ficha de ${character.name}?`)) return;

    this.characterService.delete(character.id).subscribe({
      next: () => {
        this.characters = this.characters.filter(c => c.id !== character.id);
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Error al eliminar la ficha';
        this.cdr.detectChanges();
      }
    });
  }

  isOwner(character: Character): boolean {
    return character.user_id === this.currentUserId;
  }

  resetForm() {
    this.form = {
      name: '',
      hp: 10,
      max_hp: 10,
      ac: 10,
      notes: '',
      avatar: null,
      stats: {
        fuerza: 10, destreza: 10, constitucion: 10,
        inteligencia: 10, sabiduria: 10, carisma: 10
      },
      skills: []
    };
  }
  getStatValue(stats: any, stat: string): number {
    return stats ? stats[stat] : 0;
  }

  onAvatarUpload(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.form.avatar = e.target.result;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  removeAvatar() {
    this.form.avatar = null;
    this.cdr.detectChanges();
  }

  addAttack() {
    this.form.skills.push({
      name: '',
      attackBonus: 0,
      damageDice: '1d6',
      damageBonus: 0
    });
  }

  removeAttack(index: number) {
    this.form.skills.splice(index, 1);
  }

  rollAttack(attack: CharacterAttack, char: Character) {
    this.onRollAttack.emit({ attack, character: char });
  }
}