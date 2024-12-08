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
      if (converter.domain === 'light' && converter.with === 'color_mode') {
        converter.converter('');
        converter.converter('unknown');
        converter.converter('hs');
        converter.converter('rgb');
        converter.converter('xy');
        converter.converter('color_temp');
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
    });
  });
  it('should verify the hassCommandConverter convertes', () => {
    hassCommandConverter.forEach((converter) => {
      expect(converter.domain.length).toBeGreaterThan(0);
      if (converter.domain === 'cover' && converter.service === 'set_cover_position') {
        converter.converter({ liftPercent100thsValue: 10000 });
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
    });
  });
});
