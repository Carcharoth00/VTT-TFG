import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tabletop } from './tabletop';

describe('Tabletop', () => {
  let component: Tabletop;
  let fixture: ComponentFixture<Tabletop>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tabletop]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Tabletop);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
