import React, {type ReactNode} from 'react';
import {translate} from '@docusaurus/Translate';
import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {applyTrailingSlash, removeTrailingSlash} from '@docusaurus/utils-common';
import {mergeSearchStrings, useHistorySelector} from '@docusaurus/theme-common';
import DropdownNavbarItem from '@theme/NavbarItem/DropdownNavbarItem';
import type {LinkLikeNavbarItemProps} from '@theme/NavbarItem';
import type {Props} from '@theme/NavbarItem/LocaleDropdownNavbarItem';
import IconLanguage from '@theme/Icon/Language';

import styles from './styles.module.css';

function isBaseUrlPrefixOfPathname(baseUrl: string, pathname: string): boolean {
  const baseUrlNoTrailingSlash = removeTrailingSlash(baseUrl);

  return (
    pathname === baseUrlNoTrailingSlash ||
    pathname.startsWith(`${baseUrlNoTrailingSlash}/`) ||
    pathname.startsWith(baseUrl)
  );
}

function findBestMatchingBaseUrl({
  pathname,
  candidateBaseUrls,
}: {
  pathname: string;
  candidateBaseUrls: string[];
}): string | undefined {
  let bestBaseUrl: string | undefined;
  let bestBaseUrlLength = -1;

  for (const baseUrl of candidateBaseUrls) {
    if (!isBaseUrlPrefixOfPathname(baseUrl, pathname)) {
      continue;
    }

    const baseUrlNoTrailingSlash = removeTrailingSlash(baseUrl);
    if (baseUrlNoTrailingSlash.length > bestBaseUrlLength) {
      bestBaseUrl = baseUrl;
      bestBaseUrlLength = baseUrlNoTrailingSlash.length;
    }
  }

  return bestBaseUrl;
}

function stripBaseUrlPrefix({
  pathname,
  baseUrl,
}: {
  pathname: string;
  baseUrl: string;
}): string {
  const baseUrlNoTrailingSlash = removeTrailingSlash(baseUrl);

  if (pathname === baseUrl || pathname === baseUrlNoTrailingSlash) {
    return '';
  }

  if (pathname.startsWith(`${baseUrlNoTrailingSlash}/`)) {
    return pathname.slice(baseUrlNoTrailingSlash.length + 1);
  }

  if (pathname.startsWith(baseUrl)) {
    return pathname.slice(baseUrl.length);
  }

  return removeTrailingSlash(pathname).replace(/^\//, '');
}

function useLocaleDropdownUtils() {
  const {
    siteConfig,
    i18n: {localeConfigs},
  } = useDocusaurusContext();

  const {pathname} = useLocation();
  const search = useHistorySelector((history) => history.location.search);
  const hash = useHistorySelector((history) => history.location.hash);

  const candidateBaseUrls = Object.values(localeConfigs)
    .map((localeConfig) => localeConfig.baseUrl)
    .filter((baseUrl): baseUrl is string => typeof baseUrl === 'string');

  const currentBaseUrl =
    findBestMatchingBaseUrl({pathname, candidateBaseUrls}) ?? siteConfig.baseUrl;

  const canonicalPathname = applyTrailingSlash(pathname, {
    trailingSlash: siteConfig.trailingSlash,
    baseUrl: currentBaseUrl,
  });

  // Canonical pathname, without the baseUrl of the current locale.
  // We pick the longest matching locale baseUrl so that when we're already
  // under /docs/zh/, we strip /docs/zh/ (not just /docs/).
  const pathnameSuffix = stripBaseUrlPrefix({
    pathname: canonicalPathname,
    baseUrl: currentBaseUrl,
  });

  const getLocaleConfig = (locale: string) => {
    const localeConfig = localeConfigs[locale];
    if (!localeConfig) {
      throw new Error(
        `Docusaurus bug, no locale config found for locale=${locale}`,
      );
    }
    return localeConfig;
  };

  const createUrl = ({
    locale,
    fullyQualified,
  }: {
    locale: string;
    fullyQualified: boolean;
  }) => {
    const localeConfig = getLocaleConfig(locale);
    const newUrl = `${fullyQualified ? localeConfig.url : ''}`;
    return `${newUrl}${localeConfig.baseUrl}${pathnameSuffix}`;
  };

  const getBaseURLForLocale = (locale: string) => {
    const localeConfig = getLocaleConfig(locale);
    const isSameDomain = localeConfig.url === siteConfig.url;

    if (isSameDomain) {
      // Shorter paths if localized sites are hosted on the same domain.
      // We keep the `pathname://` escape hatch so we don't rely on SPA
      // navigation when baseUrl changes between locales.
      return `pathname://${createUrl({locale, fullyQualified: false})}`;
    }

    return createUrl({locale, fullyQualified: true});
  };

  return {
    getURL: (locale: string, options: {queryString: string | undefined}) => {
      // We have 2 query strings because
      // - there's the current one
      // - there's one user can provide through navbar config
      // see https://github.com/facebook/docusaurus/pull/8915
      const finalSearch = mergeSearchStrings(
        [search, options.queryString],
        'append',
      );
      return `${getBaseURLForLocale(locale)}${finalSearch}${hash}`;
    },
    getLabel: (locale: string) => {
      return getLocaleConfig(locale).label;
    },
    getLang: (locale: string) => {
      return getLocaleConfig(locale).htmlLang;
    },
  };
}

export default function LocaleDropdownNavbarItem({
  mobile,
  dropdownItemsBefore,
  dropdownItemsAfter,
  queryString,
  ...props
}: Props): ReactNode {
  const utils = useLocaleDropdownUtils();

  const {
    i18n: {currentLocale, locales},
  } = useDocusaurusContext();

  const localeItems = locales.map((locale): LinkLikeNavbarItemProps => {
    return {
      label: utils.getLabel(locale),
      lang: utils.getLang(locale),
      to: utils.getURL(locale, {queryString}),
      target: '_self',
      autoAddBaseUrl: false,
      className:
        // eslint-disable-next-line no-nested-ternary
        locale === currentLocale
          ? // Similar idea as DefaultNavbarItem: select the right Infima active
            // class name. This cannot be substituted with isActive, because the
            // target URLs contain `pathname://` and therefore are not NavLinks!
            mobile
            ? 'menu__link--active'
            : 'dropdown__link--active'
          : '',
    };
  });

  const items = [...dropdownItemsBefore, ...localeItems, ...dropdownItemsAfter];

  // Mobile is handled a bit differently
  const dropdownLabel = mobile
    ? translate({
        message: 'Languages',
        id: 'theme.navbar.mobileLanguageDropdown.label',
        description: 'The label for the mobile language switcher dropdown',
      })
    : utils.getLabel(currentLocale);

  return (
    <DropdownNavbarItem
      {...props}
      mobile={mobile}
      label={
        <>
          <IconLanguage className={styles.iconLanguage} />
          {dropdownLabel}
        </>
      }
      items={items}
    />
  );
}

