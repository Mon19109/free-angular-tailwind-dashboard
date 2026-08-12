import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnChanges, OnInit, SimpleChanges } from '@angular/core';

export interface Option {
  value: string;
  text: string;
}

@Component({
  selector: 'app-multi-select',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './multi-select.component.html',
  styles: [`
    .multi-select-panel {
      position: relative;
      z-index: 20;
    }

    .multi-select-panel.is-open {
      margin-bottom: 15.5rem;
      z-index: 9999;
    }

    .multi-select-trigger {
      min-height: 2.75rem;
      height: auto;
    }

    .multi-select-values {
      min-width: 0;
      scrollbar-width: thin;
    }

    .multi-select-arrow-wrap {
      flex: 0 0 2.75rem;
      width: 2.75rem;
    }

    .multi-select-arrow-button {
      align-items: center;
      display: inline-flex;
      flex: 0 0 2rem;
      height: 2rem;
      justify-content: center;
      width: 2rem;
    }

    .multi-select-arrow-icon {
      flex: 0 0 1.25rem;
      height: 1.25rem;
      width: 1.25rem;
    }

    .multi-select-chip {
      flex: 0 0 auto;
      max-width: 16rem;
      gap: 0.5rem;
    }

    .multi-select-chip-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .multi-select-remove {
      align-items: center;
      display: inline-flex;
      flex: 0 0 auto;
      height: 1.125rem;
      justify-content: center;
      width: 1.125rem;
    }

    .multi-select-dropdown {
      max-height: 15rem;
      overscroll-behavior: contain;
      top: calc(100% + 0.35rem);
      z-index: 10000;
    }

    .multi-select-options {
      padding-bottom: 0.5rem;
    }
  `]
})
export class MultiSelectComponent implements OnInit, OnChanges {

  @Input() label: string = '';
  @Input() options: Option[] = [];
  @Input() defaultSelected: string[] = [];
  @Input() disabled: boolean = false;
  @Output() selectionChange = new EventEmitter<string[]>();

  selectedOptions: string[] = [];
  isOpen = false;

  ngOnInit() {
    this.selectedOptions = [...this.defaultSelected];
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['defaultSelected']) {
      this.selectedOptions = [...this.defaultSelected];
    }
  }

  toggleDropdown() {
    if (!this.disabled) this.isOpen = !this.isOpen;
  }

  handleSelect(optionValue: string) {
    if (!this.selectedOptions.includes(optionValue)) {
      this.selectedOptions = [...this.selectedOptions, optionValue];
      this.selectionChange.emit(this.selectedOptions);
    }
  }

  removeOption(value: string) {
    this.selectedOptions = this.selectedOptions.filter(opt => opt !== value);
    this.selectionChange.emit(this.selectedOptions);
  }

  get selectedValuesText(): string[] {
    return this.selectedOptions
      .map(value => this.options.find(option => option.value === value)?.text || '')
      .filter(Boolean);
  }
}
