import { TestBed } from '@angular/core/testing';
import { GlobalLoaderService } from './global-loader.service';
import { NavigationLoaderService } from './navigation-loader.service';

describe('NavigationLoaderService', () => {
  let navigation: NavigationLoaderService;
  let loader: GlobalLoaderService;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;

  function paint(): void {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(0));
  }

  beforeEach(() => {
    frames = new Map();
    nextFrame = 0;
    spyOn(window, 'requestAnimationFrame').and.callFake(callback => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    spyOn(window, 'cancelAnimationFrame').and.callFake(id => { frames.delete(id); });
    navigation = TestBed.inject(NavigationLoaderService);
    loader = TestBed.inject(GlobalLoaderService);
  });

  it('espera las consultas iniciales y el render del módulo', () => {
    navigation.start(1);
    const finish = navigation.trackRequest();
    navigation.end(1);
    paint();
    expect(loader.visible()).toBeTrue();
    finish();
    paint();
    expect(loader.visible()).toBeTrue();
    paint();
    expect(loader.visible()).toBeFalse();
  });

  it('no muestra la pantalla grande para consultas posteriores', () => {
    const finish = navigation.trackRequest();
    expect(loader.visible()).toBeFalse();
    finish();
    expect(loader.visible()).toBeFalse();
  });

  it('ignora respuestas anteriores y cierra al cancelar la navegación actual', () => {
    navigation.start(1);
    const previous = navigation.trackRequest();
    navigation.start(2);
    previous();
    navigation.cancel(1);
    expect(loader.visible()).toBeTrue();
    navigation.cancel(2);
    expect(loader.visible()).toBeFalse();
  });

  it('incluye solicitudes iniciadas al renderizar la página', () => {
    navigation.start(1);
    navigation.end(1);
    paint();
    const finish = navigation.trackRequest();
    paint();
    expect(loader.visible()).toBeTrue();
    finish();
    paint();
    paint();
    expect(loader.visible()).toBeFalse();
  });
});
