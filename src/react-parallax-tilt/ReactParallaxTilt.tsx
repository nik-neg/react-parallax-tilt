import React, { PureComponent, MouseEvent, TouchEvent } from 'react';

import { Props, SupportedEvent, EventType, CustomEventType } from './types';
import { defaultProps } from './defaultProps';
import { defaultWrapperElement } from './defaultWrapperElement';
import { Tilt } from '../features/tilt/Tilt';
import { Glare } from '../features/glare/Glare';
import { setTransition, constrainToRange } from '../common/utils';

class ReactParallaxTilt extends PureComponent<Props> {
  public static defaultProps = defaultProps;
  private wrapperEl = defaultWrapperElement;
  private tilt: Tilt<HTMLDivElement> | null = null;
  private glare: Glare | null = null;

  public componentDidMount() {
    this.loadWrapperAndChildElements();
    this.tilt = new Tilt<HTMLDivElement>();
    this.initGlare();
    const autoreset = new CustomEvent<CustomEventType>('autoreset' as CustomEventType);
    this.mainLoop(autoreset);
  }

  public componentWillUnmount() {
    clearTimeout(this.wrapperEl.transitionTimeoutId);
    if (this.wrapperEl.updateAnimationId !== null) {
      cancelAnimationFrame(this.wrapperEl.updateAnimationId);
    }
    this.removeEventListeners();
  }

  public componentDidUpdate() {
    const { onMove, onEnter, onLeave } = this.props;
    // Don't request frame if callback prop changed
    if (onMove || onEnter || onLeave) {
      return;
    }
    const propChange = new CustomEvent<CustomEventType>('propchange' as CustomEventType);
    this.mainLoop(propChange);
  }

  private addEventListeners() {
    const { gyroscope } = this.props;

    window.addEventListener('load', this.setSize);
    window.addEventListener('resize', this.setSize);

    if (gyroscope) {
      /* istanbul ignore next */
      if (!(window as any).DeviceOrientationEvent) {
        console.error("Browser doesn't support Device Orientation.");
        return;
      }
      /* istanbul ignore next */
      window.addEventListener('deviceorientation', this.onMove);
    }
  }

  private removeEventListeners() {
    const { gyroscope } = this.props;

    window.removeEventListener('load', this.setSize);
    window.removeEventListener('resize', this.setSize);
    // jest - instance of DeviceOrientationEvent not possible
    /* istanbul ignore next */
    if (gyroscope && (window as any).DeviceOrientationEvent) {
      window.removeEventListener('deviceorientation', this.onMove);
    }
  }

  public loadWrapperAndChildElements = () => {
    // initially load the component
    this.setSize();
    // if page is loaded for the first time 'load' event will be called, and load the component
    this.addEventListeners();
    // if page is not initially loaded, seTimeout will load the component as fallback
    setTimeout(() => {
      this.setSize();
    }, 100);
  };

  public setSize = () => {
    this.setWrapperElSize();
    if (this.glare) {
      this.glare.setSize(this.wrapperEl.size);
    }
  };

  private setWrapperElSize() {
    const rect = this.wrapperEl.node!.getBoundingClientRect();
    this.wrapperEl.size.width = this.wrapperEl.node!.offsetWidth;
    this.wrapperEl.size.height = this.wrapperEl.node!.offsetHeight;
    this.wrapperEl.size.left = rect.left;
    this.wrapperEl.size.top = rect.top;
  }

  private initGlare() {
    const { glareEnable } = this.props;

    if (!glareEnable) {
      return;
    }

    this.glare = new Glare(this.wrapperEl.size);
    this.wrapperEl.node!.appendChild(this.glare.glareWrapperEl);
  }

  public mainLoop = (event: SupportedEvent) => {
    if (this.wrapperEl.updateAnimationId !== null) {
      cancelAnimationFrame(this.wrapperEl.updateAnimationId);
    }
    this.processInput(event);
    this.update(event.type);
    this.wrapperEl.updateAnimationId = requestAnimationFrame(this.renderFrame);
  };

  private onEnter = (event: SupportedEvent) => {
    const { onEnter } = this.props;

    // increase performance by notifying browser 'transform' property is just about to get changed
    this.wrapperEl.node!.style.willChange = 'transform';
    this.setTransition();

    if (onEnter) {
      onEnter(event.type);
    }
  };

  private onMove = (event: SupportedEvent): void => {
    this.mainLoop(event);
    const { onMove } = this.props;

    let glareAngle = 0;
    let glareOpacity = 0;
    if (this.glare) {
      glareAngle = this.glare.glareAngle;
      glareOpacity = this.glare.glareOpacity;
    }
    if (onMove) {
      onMove(
        this.tilt!.tiltAngleX!,
        this.tilt!.tiltAngleY!,
        this.tilt!.tiltAngleXPercentage!,
        this.tilt!.tiltAngleYPercentage!,
        glareAngle,
        glareOpacity,
        event.type,
      );
    }
  };

  private onLeave = (event: SupportedEvent) => {
    const { onLeave } = this.props;
    this.setTransition();

    if (onLeave) {
      onLeave(event.type);
    }

    if (this.props.reset) {
      const autoResetEvent = new CustomEvent<CustomEventType>('autoreset' as CustomEventType);
      this.onMove(autoResetEvent);
    }
  };

  private processInput = (event: SupportedEvent): void => {
    const { scale } = this.props;

    switch (event.type as EventType) {
      case 'mousemove':
        this.wrapperEl.clientPosition.x = (event as MouseEvent).clientX;
        this.wrapperEl.clientPosition.y = (event as MouseEvent).clientY;
        this.wrapperEl.scale = scale!;
        break;
      case 'touchmove':
        this.wrapperEl.clientPosition.x = (event as TouchEvent).touches[0].pageX;
        this.wrapperEl.clientPosition.y = (event as TouchEvent).touches[0].pageY;
        this.wrapperEl.scale = scale!;
        break;
      // jest - instance of DeviceOrientationEvent not possible
      /* istanbul ignore next */
      case 'deviceorientation':
        this.processInputDeviceOrientation(event as DeviceOrientationEvent);
        this.wrapperEl.scale = scale!;
        break;
      case 'autoreset':
        this.wrapperEl.clientPosition.xPercentage = 0;
        this.wrapperEl.clientPosition.yPercentage = 0;
        this.wrapperEl.scale = 1;
        break;
    }
  };

  // jest - instance of DeviceOrientationEvent not possible
  /* istanbul ignore next */
  private processInputDeviceOrientation = (event: DeviceOrientationEvent): void => {
    if (!event.gamma || !event.beta || !this.props.gyroscope) {
      return;
    }

    const { tiltMaxAngleX, tiltMaxAngleY } = this.props;

    const angleX = event.beta; // motion of the device around the x axis in degree in the range:[-180,180]
    const angleY = event.gamma; // motion of the device around the y axis in degree in the range:[-90,90]

    this.wrapperEl.clientPosition.xPercentage = (angleX! / tiltMaxAngleX!) * 100;
    this.wrapperEl.clientPosition.yPercentage = (angleY! / tiltMaxAngleY!) * 100;

    this.wrapperEl.clientPosition.xPercentage = constrainToRange(
      this.wrapperEl.clientPosition.xPercentage,
      -100,
      100,
    );
    this.wrapperEl.clientPosition.yPercentage = constrainToRange(
      this.wrapperEl.clientPosition.yPercentage,
      -100,
      100,
    );
  };

  private update = (eventType: EventType | string): void => {
    const { tiltEnable, flipVertically, flipHorizontally } = this.props;

    this.updateClientInput(eventType);
    if (tiltEnable) {
      this.tilt!.update(this.wrapperEl.clientPosition, this.props);
    }
    this.updateFlip();
    this.tilt!.updateTiltAnglesPercentage(this.props);
    if (this.glare) {
      this.glare.update(
        this.wrapperEl.clientPosition,
        this.props,
        flipVertically!,
        flipHorizontally!,
      );
    }
  };

  private updateClientInput = (eventType: EventType | string): void => {
    // on 'autoreset' event - nothing to update, everything set to default already
    // on 'deviceorientation' event - don't calculate tilt angle, retrieved from gyroscope
    if (eventType === 'autoreset' || eventType === 'deviceorientation') {
      return;
    }

    const {
      size: { width, height, left, top },
      clientPosition: { x, y },
    } = this.wrapperEl;

    // calculate client x/y position in range [-100,100]
    const xTemp: number = ((y! - top!) / height!) * 200 - 100;
    const yTemp: number = ((x! - left!) / width!) * 200 - 100;

    this.wrapperEl.clientPosition.xPercentage = constrainToRange(xTemp, -100, 100);
    this.wrapperEl.clientPosition.yPercentage = constrainToRange(yTemp, -100, 100);
  };

  private updateFlip = (): void => {
    const { flipVertically, flipHorizontally } = this.props;

    if (flipVertically) {
      this.tilt!.tiltAngleX += 180;
      this.tilt!.tiltAngleY *= -1;
    }
    if (flipHorizontally) {
      this.tilt!.tiltAngleY += 180;
    }
  };

  public renderFrame = (): void => {
    this.resetWrapperElTransform();

    this.renderPerspective();
    this.tilt!.render(this.wrapperEl.node!);
    this.renderScale();
    if (this.glare) {
      this.glare.render(this.props);
    }
  };

  private resetWrapperElTransform(): void {
    this.wrapperEl.node!.style.transform = '';
  }

  private renderPerspective(): void {
    const { perspective } = this.props;

    this.wrapperEl.node!.style.transform += `perspective(${perspective}px) `;
  }

  private renderScale(): void {
    const { scale } = this.wrapperEl;

    this.wrapperEl.node!.style.transform += `scale3d(${scale},${scale},${scale})`;
  }

  private setTransition() {
    const { transitionSpeed, transitionEasing } = this.props;

    this.wrapperEl.transitionTimeoutId = setTransition<HTMLDivElement>(
      this.wrapperEl.node!,
      'all',
      transitionSpeed!,
      transitionEasing!,
      this.wrapperEl.transitionTimeoutId,
    );

    if (this.glare) {
      this.glare.transitionTimeoutId = setTransition<HTMLDivElement>(
        this.glare.glareEl,
        'opacity',
        transitionSpeed!,
        transitionEasing!,
        this.glare.transitionTimeoutId,
      );
    }
  }

  public render() {
    const { children, className, style } = this.props;
    return (
      <div
        ref={el => (this.wrapperEl.node = el)}
        onMouseEnter={this.onEnter}
        onMouseMove={this.onMove}
        onMouseLeave={this.onLeave}
        onTouchMove={this.onMove}
        onTouchStart={this.onEnter}
        onTouchEnd={this.onLeave}
        className={className}
        style={style}
      >
        {children}
      </div>
    );
  }
}

export default ReactParallaxTilt;