
import { Component, Input, Output, EventEmitter, ElementRef, ViewChild } from '@angular/core';
import flatpickr from 'flatpickr';
import { LabelComponent } from '../label/label.component';
import "flatpickr/dist/flatpickr.css";

@Component({
  selector: 'app-date-picker',
  imports: [LabelComponent],
  templateUrl: './date-picker.component.html',
  styles: ``
})
export class DatePickerComponent {

  @Input() id!: string;
  @Input() mode: 'single' | 'multiple' | 'range' | 'time' = 'single';
  @Input() position: 'auto' | 'above' | 'below' | 'auto left' | 'auto center' | 'auto right' = 'auto';
  @Input() defaultDate?: string | Date | string[] | Date[];
  @Input() label?: string;
  @Input() placeholder?: string;
  @Output() dateChange = new EventEmitter<any>();

  @ViewChild('dateInput', { static: false }) dateInput!: ElementRef<HTMLInputElement>;

  private flatpickrInstance: flatpickr.Instance | undefined;

  ngAfterViewInit() {
  this.flatpickrInstance = flatpickr(this.dateInput.nativeElement, {
    mode: this.mode,
    appendTo: document.body,
    position: this.position,
    positionElement: this.dateInput.nativeElement,
    monthSelectorType: 'static',

    enableTime: true,
    time_24hr: true,

    dateFormat: 'Y-m-d H:i',

    defaultDate: this.defaultDate,

    onChange: (selectedDates, dateStr, instance) => {
      this.dateChange.emit({ selectedDates, dateStr, instance });

      if (this.mode === 'single' || this.mode === 'time') {
        instance.close();
      }

      if (this.mode === 'range' && selectedDates.length === 2) {
        instance.close();
      }
    }
  });
}

  ngOnDestroy() {
    if (this.flatpickrInstance) {
      this.flatpickrInstance.destroy();
    }
  }
}
