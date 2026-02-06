import React, {type ReactNode} from 'react';
import {HtmlClassNameProvider} from '@docusaurus/theme-common';
import {useLocation} from '@docusaurus/router';
import {DocProvider} from '@docusaurus/plugin-content-docs/client';
import DocItemMetadata from '@theme/DocItem/Metadata';
import DocItemLayout from '@theme/DocItem/Layout';
import NotFoundContent from '@theme/NotFound/Content';
import type {Props} from '@theme/DocItem';

export default function DocItem(props: Props): ReactNode {
  const location = useLocation();

  // Docusaurus expects `content` to be a MDX component function with a
  // `metadata` property attached. Under certain dev/proxy edge cases, this can
  // be missing and the default theme crashes with:
  // "Cannot read properties of undefined (reading 'id')".
  const content = (props as unknown as {content?: unknown}).content as
    | {metadata?: {id?: string}}
    | undefined;

  const docId = content?.metadata?.id;
  if (!docId) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[DocItem] Missing doc metadata', {
        pathname: location.pathname,
      });
    }
    return <NotFoundContent />;
  }

  const docHtmlClassName = `docs-doc-id-${docId}`;
  const MDXComponent = props.content;

  return (
    <DocProvider content={props.content}>
      <HtmlClassNameProvider className={docHtmlClassName}>
        <DocItemMetadata />
        <DocItemLayout>
          <MDXComponent />
        </DocItemLayout>
      </HtmlClassNameProvider>
    </DocProvider>
  );
}

