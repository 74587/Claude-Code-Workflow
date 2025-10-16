/**
 * Extract Layout Structure from DOM
 *
 * Extracts real layout information from DOM to provide accurate
 * structural data for UI replication.
 *
 * Usage: Execute via Chrome DevTools evaluate_script
 */

(() => {
  /**
   * Get element's bounding box relative to viewport
   */
  const getBounds = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  };

  /**
   * Extract layout properties from an element
   */
  const extractLayoutProps = (element) => {
    const s = window.getComputedStyle(element);

    return {
      // Core layout
      display: s.display,
      position: s.position,

      // Flexbox
      flexDirection: s.flexDirection,
      justifyContent: s.justifyContent,
      alignItems: s.alignItems,
      flexWrap: s.flexWrap,
      gap: s.gap,

      // Grid
      gridTemplateColumns: s.gridTemplateColumns,
      gridTemplateRows: s.gridTemplateRows,
      gridAutoFlow: s.gridAutoFlow,

      // Dimensions
      width: s.width,
      height: s.height,
      maxWidth: s.maxWidth,
      minWidth: s.minWidth,

      // Spacing
      padding: s.padding,
      margin: s.margin
    };
  };

  /**
   * Identify layout pattern for an element
   */
  const identifyPattern = (props) => {
    const { display, flexDirection, gridTemplateColumns } = props;

    if (display === 'flex') {
      if (flexDirection === 'column') return 'flex-column';
      if (flexDirection === 'row') return 'flex-row';
      return 'flex';
    }

    if (display === 'grid') {
      const cols = gridTemplateColumns;
      if (cols && cols !== 'none') {
        const colCount = cols.split(' ').length;
        return `grid-${colCount}col`;
      }
      return 'grid';
    }

    if (display === 'inline-flex') return 'inline-flex';
    if (display === 'block') return 'block';

    return display;
  };

  /**
   * Build layout tree recursively
   */
  const buildLayoutTree = (element, depth = 0, maxDepth = 3) => {
    if (depth > maxDepth) return null;

    const props = extractLayoutProps(element);
    const bounds = getBounds(element);
    const pattern = identifyPattern(props);

    // Get semantic role
    const tagName = element.tagName.toLowerCase();
    const classes = Array.from(element.classList).slice(0, 3); // Max 3 classes
    const role = element.getAttribute('role');

    // Build node
    const node = {
      tag: tagName,
      classes: classes,
      role: role,
      pattern: pattern,
      bounds: bounds,
      layout: {
        display: props.display,
        position: props.position
      }
    };

    // Add flex/grid specific properties
    if (props.display === 'flex' || props.display === 'inline-flex') {
      node.layout.flexDirection = props.flexDirection;
      node.layout.justifyContent = props.justifyContent;
      node.layout.alignItems = props.alignItems;
      node.layout.gap = props.gap;
    }

    if (props.display === 'grid') {
      node.layout.gridTemplateColumns = props.gridTemplateColumns;
      node.layout.gridTemplateRows = props.gridTemplateRows;
      node.layout.gap = props.gap;
    }

    // Process children for container elements
    if (props.display === 'flex' || props.display === 'grid' || props.display === 'block') {
      const children = Array.from(element.children);
      if (children.length > 0 && children.length < 50) { // Limit to 50 children
        node.children = children
          .map(child => buildLayoutTree(child, depth + 1, maxDepth))
          .filter(child => child !== null);
      }
    }

    return node;
  };

  /**
   * Find main layout containers
   */
  const findMainContainers = () => {
    const selectors = [
      'body > header',
      'body > nav',
      'body > main',
      'body > footer',
      '[role="banner"]',
      '[role="navigation"]',
      '[role="main"]',
      '[role="contentinfo"]'
    ];

    const containers = [];

    selectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        const tree = buildLayoutTree(element, 0, 3);
        if (tree) {
          containers.push(tree);
        }
      }
    });

    return containers;
  };

  /**
   * Analyze layout patterns
   */
  const analyzePatterns = (containers) => {
    const patterns = {
      flexColumn: 0,
      flexRow: 0,
      grid: 0,
      sticky: 0,
      fixed: 0
    };

    const analyze = (node) => {
      if (!node) return;

      if (node.pattern === 'flex-column') patterns.flexColumn++;
      if (node.pattern === 'flex-row') patterns.flexRow++;
      if (node.pattern && node.pattern.startsWith('grid')) patterns.grid++;
      if (node.layout.position === 'sticky') patterns.sticky++;
      if (node.layout.position === 'fixed') patterns.fixed++;

      if (node.children) {
        node.children.forEach(analyze);
      }
    };

    containers.forEach(analyze);
    return patterns;
  };

  /**
   * Main extraction function
   */
  const extractLayout = () => {
    const containers = findMainContainers();
    const patterns = analyzePatterns(containers);

    return {
      metadata: {
        extractedAt: new Date().toISOString(),
        url: window.location.href,
        method: 'layout-structure'
      },
      patterns: patterns,
      structure: containers
    };
  };

  // Execute and return results
  return extractLayout();
})();
