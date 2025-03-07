/* eslint-disable react/button-has-type */
import * as React from 'react';
import classNames from 'classnames';
import omit from 'omit.js';

import Group from './button-group';
import { ConfigContext } from '../config-provider';
import Wave from '../_util/wave';
import { Omit, tuple } from '../_util/type';
import devWarning from '../_util/devWarning';
import SizeContext, { SizeType } from '../config-provider/SizeContext';
import LoadingIcon from './LoadingIcon';
import { cloneElement } from '../_util/reactNode';

// 判断是否是两个中文
const rxTwoCNChar = /^[\u4e00-\u9fa5]{2}$/;
const isTwoCNChar = rxTwoCNChar.test.bind(rxTwoCNChar);

// 判断 string
function isString(str: any) {
  return typeof str === 'string';
}

function isUnborderedButtonType(type: ButtonType | undefined) {
  return type === 'text' || type === 'link';
}

// Insert one space between two chinese characters automatically.
// 自动在两个汉字之间插入空格
function insertSpace(child: React.ReactChild, needInserted: boolean) {
  // Check the child if is undefined or null.
  if (child == null) {
    return;
  }
  const SPACE = needInserted ? ' ' : '';
  // strictNullChecks oops.
  if (
    typeof child !== 'string' &&
    typeof child !== 'number' &&
    isString(child.type) &&
    isTwoCNChar(child.props.children)
  ) {
    // React.cloneElement: https://fullstackbb.com/react/when-to-use-react-cloneelement/
    return cloneElement(child, {
      children: child.props.children.split('').join(SPACE),
    });
  }
  if (typeof child === 'string') {
    if (isTwoCNChar(child)) {
      child = child.split('').join(SPACE);
    }
    return <span>{child}</span>;
  }
  return child;
}

function spaceChildren(children: React.ReactNode, needInserted: boolean) {
  let isPrevChildPure: boolean = false;
  const childList: React.ReactNode[] = [];
  React.Children.forEach(children, child => {
    const type = typeof child;
    const isCurrentChildPure = type === 'string' || type === 'number';
    if (isPrevChildPure && isCurrentChildPure) {
      const lastIndex = childList.length - 1;
      const lastChild = childList[lastIndex];
      childList[lastIndex] = `${lastChild}${child}`;
    } else {
      childList.push(child);
    }

    isPrevChildPure = isCurrentChildPure;
  });

  // Pass to React.Children.map to auto fill key
  return React.Children.map(childList, child =>
    insertSpace(child as React.ReactChild, needInserted),
  );
}

// 定义一些类型
const ButtonTypes = tuple('default', 'primary', 'ghost', 'dashed', 'link', 'text');
export type ButtonType = typeof ButtonTypes[number];
const ButtonShapes = tuple('circle', 'round');
export type ButtonShape = typeof ButtonShapes[number];
const ButtonHTMLTypes = tuple('submit', 'button', 'reset');
export type ButtonHTMLType = typeof ButtonHTMLTypes[number];

export type LegacyButtonType = ButtonType | 'danger';
export function convertLegacyProps(type?: LegacyButtonType): ButtonProps {
  if (type === 'danger') {
    return { danger: true };
  }
  return { type };
}

export interface BaseButtonProps {
  type?: ButtonType;
  icon?: React.ReactNode;
  shape?: ButtonShape;
  size?: SizeType;
  loading?: boolean | { delay?: number };
  prefixCls?: string;
  className?: string;
  ghost?: boolean;
  danger?: boolean;
  block?: boolean;
  children?: React.ReactNode;
}

// Typescript will make optional not optional if use Pick with union.
// Should change to `AnchorButtonProps | NativeButtonProps` and `any` to `HTMLAnchorElement | HTMLButtonElement` if it fixed.
// ref: https://github.com/ant-design/ant-design/issues/15930
export type AnchorButtonProps = {
  href: string;
  target?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
} & BaseButtonProps &
  Omit<React.AnchorHTMLAttributes<any>, 'type' | 'onClick'>;

export type NativeButtonProps = {
  htmlType?: ButtonHTMLType;
  onClick?: React.MouseEventHandler<HTMLElement>;
} & BaseButtonProps &
  Omit<React.ButtonHTMLAttributes<any>, 'type' | 'onClick'>;

export type ButtonProps = Partial<AnchorButtonProps & NativeButtonProps>;

interface CompoundedComponent
  extends React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLElement>> {
  Group: typeof Group;
  __ANT_BUTTON: boolean;
}

type Loading = number | boolean;

const InternalButton: React.ForwardRefRenderFunction<unknown, ButtonProps> = (props, ref) => {
  const {
    loading = false,
    prefixCls: customizePrefixCls,
    type,
    danger,
    shape,
    size: customizeSize,
    className,
    children,
    icon,
    ghost = false,
    block = false,
    /** if we extract items here, we dont need use omit.js */
    // React does not recognize the `htmlType` prop on a DOM element. Here we pick it out of `rest`.
    htmlType = 'button' as ButtonProps['htmlType'],
    ...rest
  } = props;

  // 这里是通过 ConfigProvider 全局配置的 size
  const size = React.useContext(SizeContext);

  // button 内部的 loading 状态
  const [innerLoading, setLoading] = React.useState<Loading>(!!loading);

  // 是否是 两个中文字符
  const [hasTwoCNChar, setHasTwoCNChar] = React.useState(false);

  // 获取一些全局的配置：包括 prefixCls: 统一的样式前缀、autoInsertSpaceInButton: 移除按钮中两个汉字之间的空格、direction：文本展示方向
  const { getPrefixCls, autoInsertSpaceInButton, direction } = React.useContext(ConfigContext);

  // createRef
  const buttonRef = (ref as any) || React.createRef<HTMLElement>();

  // 使用 useRef 来储存定时器变量
  // useRef 和 createRef: https://zhuanlan.zhihu.com/p/105276393
  // 注意：setTimeout 返回值timeoutID是一个正整数，表示定时器的编号。这个值可以传递给clearTimeout()来取消该定时器。
  // 所以这里 useRef 的类型是 number
  const delayTimeoutRef = React.useRef<number>();

  // 两个中文添加空格
  const isNeedInserted = () => {
    return React.Children.count(children) === 1 && !icon && !isUnborderedButtonType(type);
  };

  const fixTwoCNChar = () => {
    // Fix for HOC usage like <FormatMessage />
    if (!buttonRef || !buttonRef.current || autoInsertSpaceInButton === false) {
      return;
    }
    const buttonText = buttonRef.current.textContent;
    if (isNeedInserted() && isTwoCNChar(buttonText)) {
      if (!hasTwoCNChar) {
        setHasTwoCNChar(true);
      }
    } else if (hasTwoCNChar) {
      setHasTwoCNChar(false);
    }
  };

  // =============== Update Loading ===============
  let loadingOrDelay: Loading;
  if (typeof loading === 'object' && loading.delay) {
    loadingOrDelay = loading.delay || true;
  } else {
    loadingOrDelay = !!loading;
  }

  React.useEffect(() => {
    clearTimeout(delayTimeoutRef.current);
    if (typeof loadingOrDelay === 'number') {
      delayTimeoutRef.current = window.setTimeout(() => {
        setLoading(loadingOrDelay);
      }, loadingOrDelay);
    } else {
      setLoading(loadingOrDelay);
    }
  }, [loadingOrDelay]);

  React.useEffect(fixTwoCNChar, [buttonRef]);

  // 处理 onClick 点击事件
  const handleClick = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement, MouseEvent>) => {
    const { onClick } = props;

    // 如果是 loading 就不触发 onClick 事件
    if (innerLoading) {
      return;
    }
    if (onClick) {
      (onClick as React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>)(e);
    }
  };

  devWarning(
    !(typeof icon === 'string' && icon.length > 2),
    'Button',
    `\`icon\` is using ReactNode instead of string naming in v4. Please check \`${icon}\` at https://ant.design/components/icon`,
  );

  devWarning(
    !(ghost && isUnborderedButtonType(type)),
    'Button',
    "`link` or `text` button can't be a `ghost` button.",
  );

  const prefixCls = getPrefixCls('btn', customizePrefixCls);
  const autoInsertSpace = autoInsertSpaceInButton !== false;

  // large => lg
  // small => sm
  let sizeCls = '';
  switch (customizeSize || size) {
    case 'large':
      sizeCls = 'lg';
      break;
    case 'small':
      sizeCls = 'sm';
      break;
    default:
      break;
  }

  const iconType = innerLoading ? 'loading' : icon;

  const classes = classNames(
    prefixCls,
    {
      [`${prefixCls}-${type}`]: type,
      [`${prefixCls}-${shape}`]: shape,
      [`${prefixCls}-${sizeCls}`]: sizeCls,
      [`${prefixCls}-icon-only`]: !children && children !== 0 && iconType,
      [`${prefixCls}-background-ghost`]: ghost && !isUnborderedButtonType(type),
      [`${prefixCls}-loading`]: innerLoading,
      [`${prefixCls}-two-chinese-chars`]: hasTwoCNChar && autoInsertSpace,
      [`${prefixCls}-block`]: block,
      [`${prefixCls}-dangerous`]: !!danger,
      [`${prefixCls}-rtl`]: direction === 'rtl',
    },
    className,
  );

  const iconNode =
    icon && !innerLoading ? (
      icon
    ) : (
      <LoadingIcon existIcon={!!icon} prefixCls={prefixCls} loading={!!innerLoading} />
    );

  const kids =
    children || children === 0
      ? spaceChildren(children, isNeedInserted() && autoInsertSpace)
      : null;

  const linkButtonRestProps = omit(rest as AnchorButtonProps, ['navigate']);
  if (linkButtonRestProps.href !== undefined) {
    return (
      <a {...linkButtonRestProps} className={classes} onClick={handleClick} ref={buttonRef}>
        {iconNode}
        {kids}
      </a>
    );
  }

  const buttonNode = (
    <button
      {...(rest as NativeButtonProps)}
      type={htmlType}
      className={classes}
      onClick={handleClick}
      ref={buttonRef}
    >
      {iconNode}
      {kids}
    </button>
  );

  if (isUnborderedButtonType(type)) {
    return buttonNode;
  }

  return <Wave>{buttonNode}</Wave>;
};

const Button = React.forwardRef<unknown, ButtonProps>(InternalButton) as CompoundedComponent;

Button.displayName = 'Button';

Button.Group = Group;
Button.__ANT_BUTTON = true;

export default Button;
