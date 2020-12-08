import * as React from 'react';
import CSSMotion from 'rc-motion';
import addEventListener from 'rc-util/lib/Dom/addEventListener';
import useMergedState from 'rc-util/lib/hooks/useMergedState';
import classNames from 'classnames';
import omit from 'omit.js';
import VerticalAlignTopOutlined from '@ant-design/icons/VerticalAlignTopOutlined';
import { throttleByAnimationFrame } from '../_util/throttleByAnimationFrame';
import { ConfigContext } from '../config-provider';
import getScroll from '../_util/getScroll';
import scrollTo from '../_util/scrollTo';
import { cloneElement } from '../_util/reactNode';

export interface BackTopProps {
  // 滚动超过多少高度后才出现 BackTop
  visibilityHeight?: number;
  // 点击事件
  onClick?: React.MouseEventHandler<HTMLElement>;
  // 设置监听滚动的目标元素 () => DOM
  target?: () => HTMLElement | Window | Document;
  prefixCls?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  duration?: number;
  visible?: boolean; // Only for test. Don't use it.
}

const BackTop: React.FC<BackTopProps> = props => {
  const [visible, setVisible] = useMergedState(false, {
    value: props.visible,
  });

  // TODO: HTMLDivElement: https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLDivElement

  // 此处 createRef 的作用是什么
  const ref = React.createRef<HTMLDivElement>();

  // 此处 useRef 用于绑定事件和移除事件
  const scrollEvent = React.useRef<any>();

  // 获取默认目标元素
  // TODO: Node.ownerDocument: https://developer.mozilla.org/zh-CN/docs/Web/API/Node/ownerDocument
  const getDefaultTarget = () => {
    return ref.current && ref.current.ownerDocument ? ref.current.ownerDocument : window;
  };

  // scroll 处理事件
  const handleScroll = throttleByAnimationFrame(
    (e: React.UIEvent<HTMLElement> | { target: any }) => {
      const { visibilityHeight } = props;
      const scrollTop = getScroll(e.target, true);
      // backTop 根据 scrollTop > visibilityHeight 时展示和隐藏
      setVisible(scrollTop > visibilityHeight!);
    },
  );

  // 给 target 绑定 scroll 监听事件
  const bindScrollEvent = () => {
    const { target } = props;
    // 没有传入 target 时就通过 getDefaultTarget 获取默认的目标元素
    const getTarget = target || getDefaultTarget;
    const container = getTarget();
    scrollEvent.current = addEventListener(container, 'scroll', (e: React.UIEvent<HTMLElement>) => {
      handleScroll(e);
    });
    handleScroll({
      target: container,
    });
  };

  React.useEffect(() => {
    bindScrollEvent();
    return () => {
      // 组件销毁时，移除事件监听
      if (scrollEvent.current) {
        scrollEvent.current.remove();
      }
      (handleScroll as any).cancel();
    };
  }, [props.target]);

  const scrollToTop = (e: React.MouseEvent<HTMLDivElement>) => {
    const { onClick, target, duration = 450 } = props;
    scrollTo(0, {
      getContainer: target || getDefaultTarget,
      duration,
    });
    // 触发 props 中的 onClick 事件
    if (typeof onClick === 'function') {
      onClick(e);
    }
  };

  const renderChildren = ({ prefixCls }: { prefixCls: string }) => {
    // 支持传入 children
    const { children } = props;

    // 默认展示的是 40 * 40 的半透明圆形 icon
    const defaultElement = (
      <div className={`${prefixCls}-content`}>
        <div className={`${prefixCls}-icon`}>
          <VerticalAlignTopOutlined />
        </div>
      </div>
    );

    // 使用 rc-animate 处理显隐动画
    return (
      <CSSMotion visible={visible} motionName="fade" removeOnLeave>
        {({ className: motionClassName }) => {
          const childNode = children || defaultElement;
          return (
            <div>
              {cloneElement(childNode, ({ className }) => ({
                className: classNames(motionClassName, className),
              }))}
            </div>
          );
        }}
      </CSSMotion>
    );
  };

  const { getPrefixCls, direction } = React.useContext(ConfigContext);

  const { prefixCls: customizePrefixCls, className = '' } = props;
  const prefixCls = getPrefixCls('back-top', customizePrefixCls);
  const classString = classNames(
    prefixCls,
    {
      [`${prefixCls}-rtl`]: direction === 'rtl',
    },
    className,
  );

  // fix https://fb.me/react-unknown-prop

  // omit 从对象中删除某些属性
  // omit.js https://github.com/benjycui/omit.js/blob/master/src/index.js
  const divProps = omit(props, [
    'prefixCls',
    'className',
    'children',
    'visibilityHeight',
    'target',
    'visible',
  ]);

  return (
    <div {...divProps} className={classString} onClick={scrollToTop} ref={ref}>
      {renderChildren({ prefixCls })}
    </div>
  );
};

BackTop.defaultProps = {
  visibilityHeight: 400,
};

export default React.memo(BackTop);
