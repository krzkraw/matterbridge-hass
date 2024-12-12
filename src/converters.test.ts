/* eslint-disable jest/no-conditional-expect */
import { FanControl, Thermostat } from 'matterbridge';
import {
  hassCommandConverter,
  hassDomainAttributeConverter,
  hassDomainConverter,
  hassDomainSensorsConverter,
  hassSubscribeConverter,
  hassUpdateAttributeConverter,
  hassUpdateStateConverter,
} from './converters';

describe('HassPlatform', () => {
  beforeAll(() => {
    //
  });

  beforeEach(() => {
    //
  });

  afterAll(() => {
    //
  });

  it('should verify the hassUpdateStateConverter converter', () => {
    hassUpdateStateConverter.forEach((converter) => {
      expect(converter.domain.length).toBeGreaterThan(0);
    });
  });
  it('should verify the hassUpdateAttributeConverter converter', () => {
    hassUpdateAttributeConverter.forEach((converter) => {
      expect(converter.domain.length).toBeGreaterThan(0);
      if (converter.domain === 'light' && converter.with === 'brightness') {
        expect(converter.converter(0)).toBe(null);
        expect(converter.converter(1)).toBe(1);
        expect(converter.converter(255)).toBe(254);
      }
      if (converter.domain === 'light' && converter.with === 'color_mode') {
        converter.converter('');
        converter.converter('unknown');
        converter.converter('hs');
        converter.converter('rgb');
        converter.converter('xy');
        converter.converter('color_temp');
      }
      if (converter.domain === 'light' && converter.with === 'color_temp') {
        converter.converter(2, { attributes: { color_mode: 'color_temp' } });
        converter.converter(undefined, {});
      }
      if (converter.domain === 'light' && converter.with === 'hs_color') {
        converter.converter([0, 0], { attributes: { color_mode: 'hs' } });
        converter.converter(undefined, {});
      }
      if (converter.domain === 'light' && converter.with === 'xy_color') {
        converter.converter([0, 0], { attributes: { color_mode: 'xy' } });
        converter.converter(undefined, {});
      }
      if (converter.domain === 'fan' && converter.with === 'percentage') {
        converter.converter(0);
        converter.converter(50);
      }
      if (converter.domain === 'fan' && converter.with === 'preset_mode') {
        converter.converter('low');
        converter.converter('medium');
        converter.converter('high');
        converter.converter('auto');
        converter.converter('none');
        converter.converter('on');
      }
      if (converter.domain === 'cover' && converter.with === 'current_position') {
        converter.converter(0);
        converter.converter(100);
        converter.converter(-1);
      }
      if (converter.domain === 'climate' && converter.with === 'temperature') {
        converter.converter(20, { state: 'heat' });
        converter.converter(20, { state: 'cool' });
        converter.converter(20, { state: '' });
        converter.converter('20', { state: '' });
      }
      if (converter.domain === 'climate' && converter.with === 'target_temp_high') {
        converter.converter(20, { state: 'heat' });
        converter.converter(20, { state: 'cool' });
        converter.converter(20, { state: 'heat_cool' });
        converter.converter('20');
      }
      if (converter.domain === 'climate' && converter.with === 'target_temp_low') {
        converter.converter(20, { state: 'heat' });
        converter.converter(20, { state: 'cool' });
        converter.converter(20, { state: 'heat_cool' });
        converter.converter('20');
      }
      if (converter.domain === 'climate' && converter.with === 'current_temperature') {
        converter.converter(20);
        converter.converter('20');
      }
    });
  });
  it('should verify the hassDomainConverter converter', () => {
    hassDomainConverter.forEach((converter) => {
      expect(converter.domain.length).toBeGreaterThan(0);
    });
  });
  it('should verify the hassDomainAttributeConverter converter', () => {
    hassDomainAttributeConverter.forEach((converter) => {
      expect(converter.domain.length).toBeGreaterThan(0);
    });
  });
  it('should verify the hassDomainSensorsConverter convertes', () => {
    hassDomainSensorsConverter.forEach((converter) => {
      expect(converter.domain.length).toBeGreaterThan(0);
      if (converter.domain === 'sensor' && converter.withStateClass === 'measurement') {
        expect(converter.converter(0)).not.toBe(null);
        expect(converter.converter(undefined)).toBe(null);
      }
    });
  });
  it('should verify the hassCommandConverter convertes', () => {
    hassCommandConverter.forEach((converter) => {
      expect(converter.domain.length).toBeGreaterThan(0);
      if (converter.domain === 'cover' && converter.service === 'set_cover_position') {
        converter.converter({ liftPercent100thsValue: 10000 });
      }
      if (converter.command.startsWith('moveTo') && converter.domain === 'light' && converter.service === 'turn_on') {
        converter.converter({ level: 1, colorTemperatureMireds: 200, colorX: 0, colorY: 0, hue: 0, saturation: 0 }, { currentHue: 0, currentSaturation: 0 });
      }
    });
  });
  it('should verify the hassSubscribeConverter convertes', () => {
    hassSubscribeConverter.forEach((converter) => {
      expect(converter.domain.length).toBeGreaterThan(0);
      if (converter.domain === 'fan' && converter.service === 'turn_on' && converter.converter) {
        converter.converter(FanControl.FanMode.Low);
        converter.converter(FanControl.FanMode.Medium);
        converter.converter(FanControl.FanMode.High);
        converter.converter(FanControl.FanMode.Auto);
        converter.converter(FanControl.FanMode.Smart);
        converter.converter(FanControl.FanMode.On);
        converter.converter(10);
      }
      if (converter.domain === 'climate' && converter.service === 'set_hvac_mode' && converter.converter) {
        converter.converter(Thermostat.SystemMode.Auto);
        converter.converter(Thermostat.SystemMode.Cool);
        converter.converter(Thermostat.SystemMode.Heat);
        converter.converter(Thermostat.SystemMode.Off);
        converter.converter(10);
      }
      if (converter.domain === 'climate' && converter.service === 'set_temperature' && converter.converter) {
        converter.converter(10);
      }
    });
  });
});
