import { Product } from './product';
import { ApiKey } from './api_key';
import { Subscriber } from './subscriber';
import { SubscriberPreference } from './subscriber_preference';
import { EventLog } from './event_log';
import { AdminUser } from './admin_user';
import { Workflow } from './workflow';
import { WorkflowVersion } from './workflow_version';
import { Template } from './template';
import { WorkflowRun } from './workflow_run';
import { RunStep } from './run_step';
import { Message } from './message';
import { Suppression } from './suppression';
import { Campaign } from './campaign';

// ---- Associations (the relationship graph) ----

Product.hasMany(ApiKey, { foreignKey: 'product_id', as: 'apiKeys' });
ApiKey.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(Subscriber, { foreignKey: 'product_id', as: 'subscribers' });
Subscriber.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Subscriber.hasMany(SubscriberPreference, { foreignKey: 'subscriber_id', as: 'preferences' });
SubscriberPreference.belongsTo(Subscriber, { foreignKey: 'subscriber_id', as: 'subscriber' });

Product.hasMany(EventLog, { foreignKey: 'product_id', as: 'events' });
EventLog.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
EventLog.belongsTo(Subscriber, { foreignKey: 'subscriber_id', as: 'subscriber' });

Product.hasMany(Workflow, { foreignKey: 'product_id', as: 'workflows' });
Workflow.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Workflow.hasMany(WorkflowVersion, { foreignKey: 'workflow_id', as: 'versions' });
WorkflowVersion.belongsTo(Workflow, { foreignKey: 'workflow_id', as: 'workflow' });
WorkflowVersion.belongsTo(AdminUser, { foreignKey: 'created_by', as: 'author' });
// active_version_id has no DB FK (avoids a cycle) but we expose the association for reads.
Workflow.belongsTo(WorkflowVersion, { foreignKey: 'active_version_id', as: 'activeVersion', constraints: false });

Product.hasMany(Template, { foreignKey: 'product_id', as: 'templates' });
Template.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Workflow.hasMany(WorkflowRun, { foreignKey: 'workflow_id', as: 'runs' });
WorkflowRun.belongsTo(Workflow, { foreignKey: 'workflow_id', as: 'workflow' });
WorkflowRun.belongsTo(WorkflowVersion, { foreignKey: 'workflow_version_id', as: 'version' });
WorkflowRun.belongsTo(Subscriber, { foreignKey: 'subscriber_id', as: 'subscriber' });
WorkflowRun.belongsTo(EventLog, { foreignKey: 'trigger_event_id', as: 'triggerEvent' });
Subscriber.hasMany(WorkflowRun, { foreignKey: 'subscriber_id', as: 'runs' });

WorkflowRun.hasMany(RunStep, { foreignKey: 'run_id', as: 'steps' });
RunStep.belongsTo(WorkflowRun, { foreignKey: 'run_id', as: 'run' });

Product.hasMany(Message, { foreignKey: 'product_id', as: 'messages' });
Message.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Message.belongsTo(Subscriber, { foreignKey: 'subscriber_id', as: 'subscriber' });
Message.belongsTo(WorkflowRun, { foreignKey: 'run_id', as: 'run' });
Message.belongsTo(RunStep, { foreignKey: 'run_step_id', as: 'runStep' });
Message.belongsTo(Template, { foreignKey: 'template_id', as: 'template' });

Product.hasMany(Suppression, { foreignKey: 'product_id', as: 'suppressions' });
Suppression.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

Product.hasMany(Campaign, { foreignKey: 'product_id', as: 'campaigns' });
Campaign.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Campaign.belongsTo(Template, { foreignKey: 'template_id', as: 'template' });
Campaign.hasMany(Message, { foreignKey: 'campaign_id', as: 'messages' });
Message.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' });

AdminUser.hasMany(WorkflowVersion, { foreignKey: 'created_by', as: 'authoredVersions' });

export {
    Product,
    ApiKey,
    Subscriber,
    SubscriberPreference,
    EventLog,
    AdminUser,
    Workflow,
    WorkflowVersion,
    Template,
    WorkflowRun,
    RunStep,
    Message,
    Suppression,
    Campaign,
};
